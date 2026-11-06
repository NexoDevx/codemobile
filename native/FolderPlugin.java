package com.codemobile.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Pasta do aparelho (Storage Access Framework): escolher, ler (texto) e gravar arquivos. */
@CapacitorPlugin(name = "Folder")
public class FolderPlugin extends Plugin {
  private static final Set<String> IGN = new HashSet<>(Arrays.asList("node_modules", ".git", ".gradle", "build", ".cache"));
  private static final String BIN = ".png.jpg.jpeg.gif.webp.ico.pdf.zip.gz.jar.apk.so.woff.woff2.ttf.otf.mp3.mp4.wav.ogg.wasm.bin.class.dex.keystore.mcpack.mcaddon.mcworld.";

  @PluginMethod
  public void status(PluginCall call) { JSObject o = new JSObject(); o.put("ok", true); call.resolve(o); }

  @PluginMethod
  public void pick(PluginCall call) {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    startActivityForResult(call, i, "pickResult");
  }

  @ActivityCallback
  private void pickResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("cancelado"); return; }
    Uri u = result.getData().getData();
    try { getContext().getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { }
    String id = DocumentsContract.getTreeDocumentId(u);
    String name = id.substring(Math.max(id.lastIndexOf('/'), id.lastIndexOf(':')) + 1);
    if (name.isEmpty()) name = "pasta";
    JSObject o = new JSObject(); o.put("uri", u.toString()); o.put("name", name); call.resolve(o);
  }

  @PluginMethod
  public void read(final PluginCall call) {
    new Thread(() -> {
      try {
        Uri tree = Uri.parse(call.getString("uri"));
        JSObject files = new JSObject(); int[] st = {0, 0, 0};
        StringBuilder sb = new StringBuilder();
        walk(tree, DocumentsContract.getTreeDocumentId(tree), "", files, st, sb);
        JSObject o = new JSObject(); o.put("files", files); o.put("skipped", st[1]); o.put("skippedText", sb.toString()); call.resolve(o);
      } catch (Exception e) { call.reject("Falha ao ler a pasta: " + e); }
    }).start();
  }

  @PluginMethod
  public void write(final PluginCall call) {
    new Thread(() -> {
      try {
        Uri tree = Uri.parse(call.getString("uri"));
        JSObject files = call.getObject("files"); int n = 0;
        Iterator<String> it = files.keys();
        while (it.hasNext()) { String p = it.next(); writeFile(tree, p, files.getString(p)); n++; }
        JSObject o = new JSObject(); o.put("count", n); call.resolve(o);
      } catch (Exception e) { call.reject("Falha ao gravar: " + e); }
    }).start();
  }

  private List<String[]> children(Uri tree, String docId) {
    List<String[]> r = new ArrayList<>();
    Uri cu = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
    try (Cursor c = getContext().getContentResolver().query(cu, new String[]{Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE}, null, null, null)) {
      if (c != null) while (c.moveToNext()) r.add(new String[]{c.getString(0), c.getString(1), c.getString(2), c.isNull(3) ? "0" : String.valueOf(c.getLong(3))});
    }
    return r;
  }

  /** Anota (até ~30 mil caracteres) o que não foi importado, para o app mostrar em _ignorados.txt. */
  private void skip(StringBuilder sb, String path, long size) { if (sb.length() < 30000) sb.append(path).append(" (").append(size / 1024).append(" KB)\n"); }

  private void walk(Uri tree, String docId, String prefix, JSObject out, int[] st, StringBuilder sb) throws Exception {
    for (String[] c : children(tree, docId)) {
      String name = c[1];
      if (Document.MIME_TYPE_DIR.equals(c[2])) { if (!IGN.contains(name)) walk(tree, c[0], prefix + name + "/", out, st, sb); continue; }
      long size = Long.parseLong(c[3]);
      String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
      if (st[0] >= 600 || size > 300000 || st[2] > 10000000 || BIN.contains("." + ext + ".")) { st[1]++; skip(sb, prefix + name, size); continue; }
      byte[] b = readAll(DocumentsContract.buildDocumentUriUsingTree(tree, c[0]));
      boolean bin = false;
      for (int k = 0; k < Math.min(b.length, 2000); k++) if (b[k] == 0) { bin = true; break; }
      if (bin) { st[1]++; skip(sb, prefix + name, size); continue; }
      out.put(prefix + name, new String(b, StandardCharsets.UTF_8)); st[0]++; st[2] += b.length;
    }
  }

  private byte[] readAll(Uri u) throws IOException {
    try (InputStream is = getContext().getContentResolver().openInputStream(u); ByteArrayOutputStream bo = new ByteArrayOutputStream()) {
      byte[] buf = new byte[8192]; int n;
      while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
      return bo.toByteArray();
    }
  }

  private String childDir(Uri tree, String parent, String name) throws IOException {
    for (String[] c : children(tree, parent)) if (c[1].equals(name) && Document.MIME_TYPE_DIR.equals(c[2])) return c[0];
    Uri d = DocumentsContract.createDocument(getContext().getContentResolver(), DocumentsContract.buildDocumentUriUsingTree(tree, parent), Document.MIME_TYPE_DIR, name);
    if (d == null) throw new IOException("não consegui criar a pasta " + name);
    return DocumentsContract.getDocumentId(d);
  }

  private void writeFile(Uri tree, String path, String text) throws IOException {
    ContentResolver cr = getContext().getContentResolver();
    String[] parts = path.split("/");
    String parent = DocumentsContract.getTreeDocumentId(tree);
    for (int i = 0; i < parts.length - 1; i++) parent = childDir(tree, parent, parts[i]);
    String name = parts[parts.length - 1], id = null;
    for (String[] c : children(tree, parent)) if (c[1].equals(name)) { id = c[0]; break; }
    Uri doc;
    if (id == null) {
      doc = DocumentsContract.createDocument(cr, DocumentsContract.buildDocumentUriUsingTree(tree, parent), "application/octet-stream", name);
      if (doc == null) throw new IOException("não consegui criar " + path);
    } else doc = DocumentsContract.buildDocumentUriUsingTree(tree, id);
    try (OutputStream os = cr.openOutputStream(doc, "wt")) { os.write((text == null ? "" : text).getBytes(StandardCharsets.UTF_8)); }
  }
}
