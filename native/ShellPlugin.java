package com.codemobile.app;

import android.system.Os;
import android.system.OsConstants;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Linux embutido: Alpine (rootfs) rodando via proot, tudo dentro do app. Sem servidor, sem Termux. */
@CapacitorPlugin(name = "Shell")
public class ShellPlugin extends Plugin {
  private static final Set<String> IGN = new HashSet<>(Arrays.asList(
    "node_modules", ".git", ".cache", ".npm", ".gradle", "__pycache__", ".venv", "venv",
    "build", "dist", "out", "target", "vendor", ".idea", ".vscode", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".tox", ".turbo", ".next", ".parcel-cache", "coverage", "Pods"
  ));
  private static final int MAX_SYNC_FILES = 2500;
  private static final long MAX_SYNC_FILE_BYTES = 512L * 1024L;

  private File root() { return new File(getContext().getFilesDir(), "alpine"); }
  private File lib(String n) { return new File(getContext().getApplicationInfo().nativeLibraryDir, n); }
  private boolean ready() { return new File(root(), ".ok").exists(); }
  private boolean hasRootfs() { try { getContext().getAssets().open("rootfs.bin").close(); return true; } catch (IOException e) { return false; } }

  @PluginMethod
  public void status(PluginCall call) {
    JSObject o = new JSObject();
    o.put("available", lib("libproot.so").exists() && lib("libproot-loader.so").exists() && hasRootfs());
    o.put("ready", ready());
    o.put("toolsReady", new File(root(), ".tools-v2").exists());
    call.resolve(o);
  }

  @PluginMethod
  public void install(final PluginCall call) {
    new Thread(() -> {
      try {
        File r = root();
        if (!lib("libproot.so").exists() || !lib("libproot-loader.so").exists() || !hasRootfs())
          throw new IOException("este APK não contém os recursos do Linux; gere um novo APK pelo GitHub Actions com o Linux habilitado.");
        File marker = new File(r, ".tools-v2");
        if (ready() && marker.exists()) {
          JSObject done = new JSObject(); done.put("ready", true); done.put("toolsReady", true); done.put("out", "Linux e ferramentas já estão configurados.");
          JSArray have = new JSArray();
          for (String x : Arrays.asList("git", "git-lfs", "python3", "pip", "node", "npm", "bash", "rg", "fd", "fzf", "jq", "yq", "tree", "curl", "wget", "ssh", "zip", "unzip", "make", "cmake", "ninja", "clang", "htop")) have.put(x);
          done.put("tools", have); call.resolve(done); return;
        }
        marker.delete();
        if (!ready()) {
          deleteRec(r); r.mkdirs();
          try (InputStream in = getContext().getAssets().open("rootfs.bin")) { untar(in, r); }
          new File(r, "tmp").mkdirs(); new File(r, "work").mkdirs(); new File(r, "root").mkdirs(); new File(r, "etc").mkdirs();
          new File(r, ".ok").createNewFile();
        }
        configureDns(r);
        // APK cache persistente: evita baixar novamente os mesmos .apk e facilita reinstalação offline.
        File apkCache = new File(r, "var/cache/apk"); apkCache.mkdirs();
        File apkCacheLink = new File(r, "etc/apk/cache");
        if (!apkCacheLink.exists()) { try { Os.symlink("/var/cache/apk", apkCacheLink.getPath()); } catch (Exception ignored) { } }
        // Use exatamente a branch da mini-rootfs para impedir mistura de versões.
        configureRepositories(r);
        String cmd = "mkdir -p /var/cache/apk /etc/apk && " +
          "if [ ! -e /etc/apk/cache ]; then ln -s /var/cache/apk /etc/apk/cache; fi && " +
          "apk update && apk add " +
          "ca-certificates bash bash-completion git git-lfs python3 py3-pip py3-virtualenv nodejs npm " +
          "ripgrep fd fzf jq yq tree curl wget openssh zip unzip tar xz vim nano " +
          "make cmake ninja build-base clang pkgconf diffutils coreutils findutils grep sed gawk " +
          "less htop ncdu sqlite";
        String output = runRootCommand(cmd, 1200);
        marker.createNewFile();

        JSObject o = new JSObject();
        o.put("ready", true);
        o.put("toolsReady", true);
        o.put("out", output);
        JSArray tools = new JSArray();
        for (String x : Arrays.asList("git", "git-lfs", "python3", "pip", "node", "npm", "bash", "rg", "fd", "fzf", "jq", "yq", "tree", "curl", "wget", "ssh", "zip", "unzip", "make", "cmake", "ninja", "clang", "htop")) tools.put(x);
        o.put("tools", tools);
        call.resolve(o);
      } catch (Exception e) { call.reject("Falha ao preparar o Linux e instalar as ferramentas: " + e.getMessage()); }
    }).start();
  }

  private void configureRepositories(File r) throws Exception {
    File rel = new File(r, "etc/alpine-release");
    String release = rel.exists() ? new String(readAll(rel), StandardCharsets.UTF_8).trim() : "";
    String branch = release.replaceAll("^([0-9]+\\.[0-9]+).*$", "$1");
    if (!branch.matches("[0-9]+\\.[0-9]+")) throw new IOException("não consegui identificar a versão do Alpine: " + release);
    File repo = new File(r, "etc/apk/repositories"); repo.getParentFile().mkdirs();
    String urls = "https://dl-cdn.alpinelinux.org/alpine/v" + branch + "/main\n" +
      "https://dl-cdn.alpinelinux.org/alpine/v" + branch + "/community\n";
    write(repo, urls);
  }

  private void configureDns(File r) {
    LinkedHashSet<String> dns = new LinkedHashSet<>();
    try {
      ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
      if (cm != null && android.os.Build.VERSION.SDK_INT >= 23) {
        Network net = cm.getActiveNetwork();
        LinkProperties lp = net == null ? null : cm.getLinkProperties(net);
        if (lp != null) for (java.net.InetAddress a : lp.getDnsServers()) if (a != null) dns.add(a.getHostAddress());
      }
    } catch (Exception ignored) { }
    if (dns.isEmpty()) { dns.add("1.1.1.1"); dns.add("8.8.8.8"); }
    StringBuilder b = new StringBuilder(); for (String d : dns) b.append("nameserver ").append(d).append('\n');
    try { File f = new File(r, "etc/resolv.conf"); f.getParentFile().mkdirs(); write(f, b.toString()); } catch (Exception ignored) { }
  }

  private String runRootCommand(String cmd, int timeoutSeconds) throws Exception {
    File tmp = new File(getContext().getCacheDir(), "proot-install-tmp"); tmp.mkdirs();
    List<String> a = new ArrayList<>(Arrays.asList(lib("libproot.so").getPath(), "-0", "--link2symlink", "--kill-on-exit",
      "-r", root().getPath(), "-b", "/dev", "-b", "/proc", "-w", "/root", "/bin/sh", "-c", cmd));
    ProcessBuilder pb = new ProcessBuilder(a); pb.redirectErrorStream(true);
    Map<String, String> env = pb.environment(); env.clear();
    env.put("PROOT_LOADER", lib("libproot-loader.so").getPath());
    env.put("PROOT_TMP_DIR", tmp.getPath()); env.put("PROOT_NO_SECCOMP", "1");
    env.put("HOME", "/root"); env.put("PATH", "/opt/gradle/current/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"); env.put("GRADLE_HOME", "/opt/gradle/current");
    env.put("TERM", "xterm-256color"); env.put("LANG", "C.UTF-8"); env.put("CI", "1");
    env.put("PAGER", "cat"); env.put("GIT_PAGER", "cat"); env.put("GIT_TERMINAL_PROMPT", "0");
    env.put("TMPDIR", "/tmp"); env.put("PYTHONUNBUFFERED", "1");
    Process process = pb.start();
    StringBuilder output = new StringBuilder();
    Thread reader = new Thread(() -> {
      try (InputStream in = process.getInputStream()) {
        byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) synchronized (output) {
          output.append(new String(buf, 0, n, StandardCharsets.UTF_8));
          if (output.length() > 30000) output.delete(0, output.length() - 18000);
        }
      } catch (IOException ignored) { }
    });
    reader.start();
    long end = System.currentTimeMillis() + timeoutSeconds * 1000L;
    int code;
    while (true) {
      try { code = process.exitValue(); break; }
      catch (IllegalThreadStateException running) {
        if (System.currentTimeMillis() > end) {
          process.destroy();
          try { Thread.sleep(300); } catch (InterruptedException ignored) { }
          if (process.isAlive()) process.destroyForcibly();
          throw new IOException("tempo limite ao instalar pacotes. Tente novamente com uma conexão estável.");
        }
        try { Thread.sleep(120); } catch (InterruptedException ignored) { }
      }
    }
    reader.join(2000);
    String text; synchronized (output) { text = output.toString(); }
    if (code != 0) throw new IOException("apk terminou com código " + code + ":\n" + text);
    return text;
  }

  @PluginMethod
  public void exec(final PluginCall call) {
    new Thread(() -> {
      try {
        if (!ready()) { call.reject("Linux embutido não instalado"); return; }
        String cmd = call.getString("cmd", "");
        if (cmd == null || cmd.trim().isEmpty()) { call.reject("cmd vazio"); return; }
        String raw = call.getString("project", "projeto");
        String project = raw.replaceAll("[^\\w.-]+", "_").replaceAll("^\\.+", "_");
        if (project.length() > 48) project = project.substring(0, 48);
        if (project.isEmpty()) project = "projeto";
        if (!project.equals(raw)) project += "-" + sha8(raw);   // nomes diferentes nunca colidem
        int to = Math.max(1, Math.min(call.getInt("timeout", 60), 1800));
        File base = new File(getContext().getFilesDir(), "ws/" + project); base.mkdirs();

        // 1) sincroniza somente os arquivos alterados (delta) quando o app
        // já enviou o projeto antes. Isso evita reenviar dezenas de MB a cada comando.
        JSObject files = call.getObject("files", new JSObject());
        boolean delta = call.getBoolean("delta", false);
        Set<String> keep = new HashSet<>();
        String baseCanon = base.getCanonicalPath() + File.separator;
        File mf = new File(getContext().getFilesDir(), "manifest/" + project + ".txt"); mf.getParentFile().mkdirs();
        Set<String> man = new HashSet<>();
        if (mf.exists()) for (String ln : new String(readAll(mf), StandardCharsets.UTF_8).split("\n")) if (!ln.isEmpty()) man.add(ln);
        if (delta) keep.addAll(man);
        Map<String, String> disk = new TreeMap<>(); walk(base, "", disk);
        Iterator<String> it = files.keys();
        while (it.hasNext()) {
          String k = it.next();
          if (!safeRelative(k)) continue;
          String v = files.optString(k, "");
          keep.add(k);
          if (!v.equals(disk.get(k))) {
            File f = new File(base, k); File parent = f.getParentFile(); if (parent != null) parent.mkdirs();
            if (!f.getCanonicalPath().startsWith(baseCanon) || isLink(f)) continue;
            write(f, v);
          }
        }
        if (delta) {
          JSArray deleted = call.getArray("deletedFiles", new JSArray());
          for (int i = 0; i < deleted.length(); i++) {
            String k = deleted.optString(i, ""); if (!safeRelative(k)) continue;
            keep.remove(k); File f = new File(base, k);
            if (f.getCanonicalPath().startsWith(baseCanon) && !isLink(f) && f.isFile()) f.delete();
          }
        } else {
          // Na sincronização inicial, só apaga arquivos que o app gerenciava.
          for (String k : man) if (!keep.contains(k)) { File f = new File(base, k); if (f.getCanonicalPath().startsWith(baseCanon) && !isLink(f) && f.isFile()) f.delete(); }
        }
        Map<String, String> before = new TreeMap<>(); walk(base, "", before);

        // 2) roda no Alpine via proot
        File tmp = new File(getContext().getCacheDir(), "proot-tmp"); tmp.mkdirs();
        String requestedCwd = call.getString("cwd", "");
        File workDir = requestedCwd == null || requestedCwd.trim().isEmpty() ? base : new File(base, requestedCwd).getCanonicalFile();
        if (!workDir.getCanonicalPath().equals(base.getCanonicalPath()) && !workDir.getCanonicalPath().startsWith(baseCanon))
          throw new IOException("diretório fora do projeto recusado");
        if (!workDir.isDirectory()) throw new IOException("diretório não encontrado: " + requestedCwd);
        String prootCwd = "/work" + (workDir.equals(base) ? "" : "/" + base.toPath().relativize(workDir.toPath()).toString().replace(File.separatorChar, '/'));
        List<String> a = new ArrayList<>(Arrays.asList(lib("libproot.so").getPath(), "-0", "--link2symlink", "--kill-on-exit",
            "-r", root().getPath(), "-b", "/dev", "-b", "/proc", "-b", base.getPath() + ":/work", "-w", prootCwd, "/bin/sh", "-c", cmd));
        ProcessBuilder pb = new ProcessBuilder(a); pb.redirectErrorStream(true);
        Map<String, String> env = pb.environment(); env.clear();
        env.put("PROOT_LOADER", lib("libproot-loader.so").getPath()); env.put("PROOT_TMP_DIR", tmp.getPath()); env.put("PROOT_NO_SECCOMP", "1");
        env.put("HOME", "/root"); env.put("PATH", "/opt/gradle/current/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"); env.put("GRADLE_HOME", "/opt/gradle/current"); env.put("TERM", "xterm-256color"); env.put("LANG", "C.UTF-8");
        env.put("CI", "1"); env.put("PAGER", "cat"); env.put("GIT_PAGER", "cat"); env.put("GIT_TERMINAL_PROMPT", "0"); env.put("GIT_EDITOR", "true");
        env.put("TMPDIR", "/tmp"); env.put("PYTHONUNBUFFERED", "1"); env.put("GRADLE_USER_HOME", "/root/.gradle");
        env.put("npm_config_cache", "/root/.npm"); env.put("PIP_CACHE_DIR", "/root/.cache/pip"); env.put("CARGO_HOME", "/root/.cargo"); env.put("ANDROID_USER_HOME", "/root/.android");
        env.put("NO_COLOR", "1"); env.put("FORCE_COLOR", "0"); env.put("GIT_CONFIG_NOSYSTEM", "0");
        final Process p = pb.start();
        final StringBuilder sb = new StringBuilder();
        Thread rd = new Thread(() -> {
          try (InputStream in = p.getInputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) { synchronized (sb) { sb.append(new String(buf, 0, n, StandardCharsets.UTF_8)); if (sb.length() > 60000) sb.delete(0, sb.length() - 30000); } }
          } catch (IOException e) { }
        });
        rd.start();
        long end = System.currentTimeMillis() + to * 1000L; boolean timedOut = false; int code = -1;
        while (true) {
          try { code = p.exitValue(); break; }
          catch (IllegalThreadStateException e) {
            if (System.currentTimeMillis() > end) {
              timedOut = true; p.destroy();
              try { if (!p.waitFor(700, java.util.concurrent.TimeUnit.MILLISECONDS)) p.destroyForcibly(); p.waitFor(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); p.destroyForcibly(); }
              code = 124; break;
            }
            try { Thread.sleep(100); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); p.destroyForcibly(); throw ie; }
          }
        }
        rd.join(2500);

        // 3) o que mudou no disco volta para o projeto
        Map<String, String> after = new TreeMap<>(); walk(base, "", after);
        JSObject ch = new JSObject(); JSArray del = new JSArray();
        for (Map.Entry<String, String> e : after.entrySet()) if (!e.getValue().equals(before.get(e.getKey()))) ch.put(e.getKey(), e.getValue());
        for (String k : before.keySet()) if (!after.containsKey(k)) del.put(k);
        Set<String> known = new HashSet<>(keep);
        Iterator<String> ck = ch.keys(); while (ck.hasNext()) known.add(ck.next());
        for (String k : before.keySet()) if (!after.containsKey(k)) known.remove(k);
        StringBuilder mb = new StringBuilder(); for (String k : known) mb.append(k).append('\n');
        write(mf, mb.toString());
        String out; synchronized (sb) { out = sb.toString(); }
        if (out.length() > 12000) out = out.substring(out.length() - 12000);
        JSObject r = new JSObject();
        r.put("code", code); r.put("out", out); r.put("timedOut", timedOut); r.put("changed", ch); r.put("deleted", del);
        call.resolve(r);
      } catch (Exception e) { call.reject("Erro no terminal: " + e); }
    }).start();
  }

  // ---------- utilidades ----------
  private static boolean safeRelative(String k) {
    if (k == null || k.isEmpty() || k.startsWith("/") || k.indexOf('\\') >= 0 || k.contains("../") || k.equals("..") || k.equals(".")) return false;
    for (String part : k.split("/")) if (part.isEmpty() || part.equals("..") || part.equals(".")) return false;
    return true;
  }

  private static String sha8(String s) throws Exception {
    byte[] d = java.security.MessageDigest.getInstance("SHA-1").digest(s.getBytes(StandardCharsets.UTF_8));
    StringBuilder b = new StringBuilder(); for (int i = 0; i < 4; i++) b.append(String.format("%02x", d[i])); return b.toString();
  }

  private static boolean isLink(File f) { try { return OsConstants.S_ISLNK(Os.lstat(f.getPath()).st_mode); } catch (Exception e) { return false; } }

  private void deleteRec(File f) {
    try { if (OsConstants.S_ISDIR(Os.lstat(f.getPath()).st_mode)) { File[] c = f.listFiles(); if (c != null) for (File x : c) deleteRec(x); } } catch (Exception e) { }
    f.delete();
  }

  private void walk(File base, String rel, Map<String, String> out) {
    File[] fs = new File(base, rel).listFiles();
    if (fs == null) return;
    Arrays.sort(fs);
    for (File f : fs) {
      String n = f.getName();
      if (IGN.contains(n) || isLink(f)) continue;
      String r = rel.isEmpty() ? n : rel + "/" + n;
      if (f.isDirectory()) walk(base, r, out);
      else if (f.isFile() && out.size() < MAX_SYNC_FILES && f.length() <= MAX_SYNC_FILE_BYTES) {
        try {
          byte[] b = readAll(f); boolean bin = false;
          for (byte x : b) if (x == 0) { bin = true; break; }
          if (!bin) out.put(r, new String(b, StandardCharsets.UTF_8));
        } catch (IOException e) { }
      }
    }
  }

  private static byte[] readAll(File f) throws IOException {
    try (FileInputStream in = new FileInputStream(f)) {
      ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
      while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
      return o.toByteArray();
    }
  }

  private static void write(File f, String s) throws IOException {
    try (FileOutputStream o = new FileOutputStream(f)) { o.write(s.getBytes(StandardCharsets.UTF_8)); }
    if (s.startsWith("#!") || "gradlew".equals(f.getName())) f.setExecutable(true, false);
  }

  private static void copy(File a, File b) throws IOException {
    try (FileInputStream in = new FileInputStream(a); FileOutputStream o = new FileOutputStream(b)) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); }
  }

  private static String cstr(byte[] b, int off, int len) { int e = off; while (e < off + len && b[e] != 0) e++; return new String(b, off, e - off, StandardCharsets.UTF_8); }
  private static long oct(byte[] b, int off, int len) { String s = cstr(b, off, len).trim(); return s.isEmpty() ? 0 : Long.parseLong(s, 8); }

  private static void skipN(DataInputStream in, long n) throws IOException {
    while (n > 0) { int k = in.skipBytes((int) Math.min(n, Integer.MAX_VALUE)); if (k <= 0) { if (in.read() < 0) break; k = 1; } n -= k; }
  }

  /** tar.gz -> pasta (arquivos, pastas, symlinks e hardlinks; sem depender de nada externo) */
  private void untar(InputStream raw, File dest) throws Exception {
    DataInputStream in = new DataInputStream(new BufferedInputStream(new GZIPInputStream(raw), 1 << 16));
    byte[] h = new byte[512]; String longName = null;
    while (true) {
      try { in.readFully(h); } catch (EOFException e) { break; }
      if (h[0] == 0) break;
      String name = cstr(h, 0, 100); long size = oct(h, 124, 12); int mode = (int) oct(h, 100, 8); char t = (char) h[156]; String link = cstr(h, 157, 100);
      if ("ustar".equals(cstr(h, 257, 5))) { String pre = cstr(h, 345, 155); if (!pre.isEmpty()) name = pre + "/" + name; }
      long pad = (512 - size % 512) % 512;
      if (t == 'L') { byte[] b = new byte[(int) size]; in.readFully(b); skipN(in, pad); longName = cstr(b, 0, b.length); continue; }
      if (t == 'x' || t == 'g' || t == 'K') { skipN(in, size + pad); continue; }
      if (longName != null) { name = longName; longName = null; }
      while (name.startsWith("./")) name = name.substring(2);
      while (name.startsWith("/")) name = name.substring(1);
      if (name.isEmpty() || name.equals(".") || name.equals("..") || name.contains("../")) { skipN(in, size + pad); continue; }
      File f = new File(dest, name);
      f.getParentFile().mkdirs();
      if (t == '5') { f.mkdirs(); f.setReadable(true, false); f.setWritable(true, true); f.setExecutable(true, false); }
      else if (t == '2') { f.delete(); Os.symlink(link, f.getPath()); }
      else if (t == '1') { copy(new File(dest, link.replaceFirst("^\\./", "")), f); f.setExecutable((mode & 0111) != 0, false); }
      else if (t == '0' || t == '\0' || t == '7') {
        try (FileOutputStream o = new FileOutputStream(f)) {
          byte[] buf = new byte[1 << 16]; long left = size;
          while (left > 0) { int n = in.read(buf, 0, (int) Math.min(buf.length, left)); if (n < 0) throw new EOFException(); o.write(buf, 0, n); left -= n; }
        }
        f.setReadable(true, false); f.setWritable(true, true); f.setExecutable((mode & 0111) != 0, false);
        skipN(in, pad);
        continue;
      }
      skipN(in, size + pad);
    }
  }
}
