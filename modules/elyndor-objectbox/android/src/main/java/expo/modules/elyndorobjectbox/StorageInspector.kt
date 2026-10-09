package expo.modules.elyndorobjectbox

import android.content.Context
import android.os.StatFs
import java.io.File
import java.nio.file.Files
import java.util.ArrayDeque
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

/**
 * Inventaire strictement en lecture seule des dossiers privés d'Elyndor.
 *
 * Aucun accès au contenu des fichiers ni aux dossiers des autres applications.
 * Les chemins exposés à JavaScript sont relatifs aux deux racines autorisées.
 */
internal object ElyndorStorageInspector {
  private const val MAX_SCAN_NODES = 200_000
  private const val PAGE_SIZE = 100

  private data class Usage(
    var bytes: Long = 0,
    var files: Long = 0,
    var directories: Long = 0,
    var incomplete: Boolean = false,
  )

  private fun roots(context: Context): List<Pair<String, File>> {
    val values = mutableListOf("interne" to File(context.applicationInfo.dataDir))
    context.getExternalFilesDir(null)?.let { values.add("externe" to it) }
    return values
  }

  private fun symlink(file: File): Boolean =
    try { Files.isSymbolicLink(file.toPath()) } catch (_: Exception) { true }

  private fun scan(root: File): Usage {
    val result = Usage()
    if (!root.exists()) return result
    val pending = ArrayDeque<File>()
    pending.add(root)
    var visited = 0
    while (!pending.isEmpty()) {
      if (++visited > MAX_SCAN_NODES) {
        result.incomplete = true
        break
      }
      val item = pending.removeLast()
      if (symlink(item)) {
        result.incomplete = true
        continue
      }
      if (item.isFile) {
        result.files++
        result.bytes += item.length().coerceAtLeast(0)
      } else if (item.isDirectory) {
        result.directories++
        val children = item.listFiles()
        if (children == null) {
          result.incomplete = true
        } else {
          for (child in children) pending.add(child)
        }
      } else {
        result.incomplete = true
      }
    }
    return result
  }

  private fun usageJson(usage: Usage): JSONObject =
    JSONObject()
      .put("sizeBytes", usage.bytes)
      .put("fileCount", usage.files)
      .put("directoryCount", usage.directories)
      .put("incomplete", usage.incomplete)

  fun summary(context: Context): String {
    val disk = StatFs(context.filesDir.absolutePath)
    val rootValues = JSONArray()
    var size = 0L
    var files = 0L
    var directories = 0L
    var incomplete = false

    for ((id, root) in roots(context)) {
      val usage = scan(root)
      size += usage.bytes
      files += usage.files
      directories += usage.directories
      incomplete = incomplete || usage.incomplete
      rootValues.put(
        usageJson(usage)
          .put("id", id)
          .put("label", if (id == "interne") "Données privées Elyndor" else "Fichiers externes Elyndor")
          .put("path", id),
      )
    }

    return JSONObject()
      .put("totalBytes", disk.totalBytes)
      .put("availableBytes", disk.availableBytes)
      .put("appBytes", size)
      .put("fileCount", files)
      .put("directoryCount", directories)
      .put("incomplete", incomplete)
      .put("scannedAt", System.currentTimeMillis())
      .put("roots", rootValues)
      .toString()
  }

  private fun resolve(context: Context, path: String): File {
    val normalized = path.trim().trim('/')
    val rootId = normalized.substringBefore('/')
    val base = roots(context).firstOrNull { it.first == rootId }?.second
      ?: throw IllegalArgumentException("Dossier de stockage inconnu.")
    val canonicalBase = base.canonicalFile
    val relative = normalized.substringAfter('/', "")
    val resolved = if (relative.isEmpty()) canonicalBase else File(canonicalBase, relative).canonicalFile
    require(resolved == canonicalBase || resolved.path.startsWith(canonicalBase.path + File.separator)) {
      "Accès hors des dossiers Elyndor refusé."
    }
    require(resolved.exists() && resolved.isDirectory && !symlink(resolved)) {
      "Dossier introuvable ou inaccessible."
    }
    return resolved
  }

  /** Retourne au plus 100 éléments par page, sans lire ni modifier leur contenu. */
  fun list(context: Context, path: String, offset: Int): String {
    require(offset >= 0) { "Pagination invalide." }
    if (path.isBlank()) {
      val entries = JSONArray()
      for ((id, root) in roots(context)) {
        entries.put(
          usageJson(scan(root))
            .put("name", if (id == "interne") "Données privées Elyndor" else "Fichiers externes Elyndor")
            .put("path", id)
            .put("isDirectory", true)
            .put("modifiedAt", root.lastModified()),
        )
      }
      return JSONObject()
        .put("path", "")
        .put("entries", entries)
        .put("totalChildren", entries.length())
        .put("nextOffset", JSONObject.NULL)
        .toString()
    }

    val directory = resolve(context, path)
    val all = directory.listFiles() ?: throw IllegalStateException("Impossible de lire ce dossier.")
    // Ne jamais suivre les liens symboliques, même si Android en expose un.
    val safe = all.filter { !symlink(it) }.sortedWith(
      compareByDescending<File> { it.isDirectory }
        .thenBy { it.name.lowercase(Locale.ROOT) },
    )
    val entries = JSONArray()
    for (item in safe.drop(offset).take(PAGE_SIZE)) {
      val usage = scan(item)
      entries.put(
        usageJson(usage)
          .put("name", item.name)
          .put("path", path.trimEnd('/') + "/" + item.name)
          .put("isDirectory", item.isDirectory)
          .put("modifiedAt", item.lastModified()),
      )
    }
    val next = offset + entries.length()
    return JSONObject()
      .put("path", path)
      .put("entries", entries)
      .put("totalChildren", safe.size)
      .put("nextOffset", if (next < safe.size) next else JSONObject.NULL)
      .toString()
  }
}
