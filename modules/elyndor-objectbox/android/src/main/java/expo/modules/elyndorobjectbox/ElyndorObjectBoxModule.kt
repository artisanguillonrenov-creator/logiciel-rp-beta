package expo.modules.elyndorobjectbox

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.objectbox.Box
import io.objectbox.BoxStore
import io.objectbox.query.Query
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class ElyndorObjectBoxModule : Module() {
  companion object {
    @Volatile private var storeInstance: BoxStore? = null

    private fun getStore(context: android.content.Context): BoxStore {
      return storeInstance ?: synchronized(this) {
        storeInstance ?: MyObjectBox.builder()
          .androidContext(context.applicationContext)
          .directory(File(context.filesDir, "elyndor-objectbox"))
          .build()
          .also { storeInstance = it }
      }
    }
  }

  private data class VectorPayload(
    val externalId: String,
    val contentHash: String,
    val vector: FloatArray,
    val timestamp: Long = 0,
  )

  override fun definition() = ModuleDefinition {
    Name("ElyndorObjectBox")

    AsyncFunction("syncLore") { namespace: String, entriesJson: String ->
      val store = requireStore()
      syncLore(store, namespace, parseEntries(entriesJson))
    }

    AsyncFunction("searchLore") { namespace: String, vectorJson: String, maxCount: Int ->
      val store = requireStore()
      searchLore(store, namespace, parseVector(vectorJson), maxCount).toString()
    }

    AsyncFunction("syncHistory") { storyId: String, entriesJson: String ->
      val store = requireStore()
      syncHistory(store, storyId, parseEntries(entriesJson))
    }

    AsyncFunction("searchHistory") { storyId: String, vectorJson: String, maxCount: Int ->
      val store = requireStore()
      searchHistory(store, storyId, parseVector(vectorJson), maxCount).toString()
    }

    AsyncFunction("clearStory") { storyId: String ->
      val store = requireStore()
      val loreBox = store.boxFor(LoreVectorRecord::class.java)
      val historyBox = store.boxFor(HistoryVectorRecord::class.java)
      store.runInTx {
        removeLoreNamespace(loreBox, storyId)
        removeHistoryStory(historyBox, storyId)
      }
      true
    }
  }

  private fun requireStore(): BoxStore {
    val context = appContext.reactContext
      ?: throw IllegalStateException("Contexte Android indisponible pour ObjectBox.")
    return getStore(context)
  }

  private fun parseVector(json: String): FloatArray {
    val array = JSONArray(json)
    val vector = FloatArray(array.length()) { index -> array.getDouble(index).toFloat() }
    requireSupportedDimension(vector.size)
    return vector
  }

  private fun parseEntries(json: String): List<VectorPayload> {
    val array = JSONArray(json)
    return List(array.length()) { index ->
      val item = array.getJSONObject(index)
      val vectorArray = item.getJSONArray("vector")
      val vector = FloatArray(vectorArray.length()) { i -> vectorArray.getDouble(i).toFloat() }
      requireSupportedDimension(vector.size)
      VectorPayload(
        externalId = item.getString("id"),
        contentHash = item.optString("hash", ""),
        vector = vector,
        timestamp = item.optLong("timestamp", 0),
      )
    }
  }

  private fun requireSupportedDimension(size: Int) {
    require(size == 384 || size == 768 || size == 1024 || size == 1536 || size == 4096) {
      "Dimension d'embedding non supportée par l'index ObjectBox: $size"
    }
  }

  private fun applyVector(record: LoreVectorRecord, vector: FloatArray) {
    record.vector384 = null
    record.vector768 = null
    record.vector1024 = null
    record.vector1536 = null
    record.vector4096 = null
    when (vector.size) {
      384 -> record.vector384 = vector
      768 -> record.vector768 = vector
      1024 -> record.vector1024 = vector
      1536 -> record.vector1536 = vector
      4096 -> record.vector4096 = vector
      else -> requireSupportedDimension(vector.size)
    }
  }

  private fun applyVector(record: HistoryVectorRecord, vector: FloatArray) {
    record.vector384 = null
    record.vector768 = null
    record.vector1024 = null
    record.vector1536 = null
    record.vector4096 = null
    when (vector.size) {
      384 -> record.vector384 = vector
      768 -> record.vector768 = vector
      1024 -> record.vector1024 = vector
      1536 -> record.vector1536 = vector
      4096 -> record.vector4096 = vector
      else -> requireSupportedDimension(vector.size)
    }
  }

  private fun findLore(box: Box<LoreVectorRecord>, namespace: String, externalId: String): LoreVectorRecord? {
    val query = box.query(
      LoreVectorRecord_.namespace.equal(namespace)
        .and(LoreVectorRecord_.externalId.equal(externalId))
    ).build()
    return try { query.findFirst() } finally { query.close() }
  }

  private fun findHistory(box: Box<HistoryVectorRecord>, storyId: String, externalId: String): HistoryVectorRecord? {
    val query = box.query(
      HistoryVectorRecord_.storyId.equal(storyId)
        .and(HistoryVectorRecord_.externalId.equal(externalId))
    ).build()
    return try { query.findFirst() } finally { query.close() }
  }

  private fun syncLore(store: BoxStore, namespace: String, entries: List<VectorPayload>): Int {
    val box = store.boxFor(LoreVectorRecord::class.java)
    val currentIds = entries.mapTo(HashSet()) { it.externalId }
    var changed = 0
    store.runInTx {
      for (entry in entries) {
        val existing = findLore(box, namespace, entry.externalId)
        if (existing != null && existing.contentHash == entry.contentHash && vectorDimension(existing) == entry.vector.size) {
          continue
        }
        val record = existing ?: LoreVectorRecord(namespace = namespace, externalId = entry.externalId)
        record.contentHash = entry.contentHash
        applyVector(record, entry.vector)
        box.put(record)
        changed++
      }

      val query = box.query(LoreVectorRecord_.namespace.equal(namespace)).build()
      val stale = try { query.find().filter { it.externalId !in currentIds } } finally { query.close() }
      for (record in stale) {
        box.remove(record.id)
        changed++
      }
    }
    return changed
  }

  private fun syncHistory(store: BoxStore, storyId: String, entries: List<VectorPayload>): Int {
    val box = store.boxFor(HistoryVectorRecord::class.java)
    val currentIds = entries.mapTo(HashSet()) { it.externalId }
    var changed = 0
    store.runInTx {
      for (entry in entries) {
        val existing = findHistory(box, storyId, entry.externalId)
        if (existing != null && existing.contentHash == entry.contentHash && vectorDimension(existing) == entry.vector.size) {
          continue
        }
        val record = existing ?: HistoryVectorRecord(storyId = storyId, externalId = entry.externalId)
        record.contentHash = entry.contentHash
        record.timestamp = entry.timestamp
        applyVector(record, entry.vector)
        box.put(record)
        changed++
      }

      val query = box.query(HistoryVectorRecord_.storyId.equal(storyId)).build()
      val stale = try { query.find().filter { it.externalId !in currentIds } } finally { query.close() }
      for (record in stale) {
        box.remove(record.id)
        changed++
      }
    }
    return changed
  }

  private fun vectorDimension(record: LoreVectorRecord): Int = when {
    record.vector384 != null -> 384
    record.vector768 != null -> 768
    record.vector1024 != null -> 1024
    record.vector1536 != null -> 1536
    record.vector4096 != null -> 4096
    else -> 0
  }

  private fun vectorDimension(record: HistoryVectorRecord): Int = when {
    record.vector384 != null -> 384
    record.vector768 != null -> 768
    record.vector1024 != null -> 1024
    record.vector1536 != null -> 1536
    record.vector4096 != null -> 4096
    else -> 0
  }

  private fun loreQuery(
    box: Box<LoreVectorRecord>,
    namespace: String,
    vector: FloatArray,
    maxCount: Int,
  ): Query<LoreVectorRecord> {
    val count = maxCount.coerceIn(1, 100)
    val condition = when (vector.size) {
      384 -> LoreVectorRecord_.vector384.nearestNeighbors(vector, count)
      768 -> LoreVectorRecord_.vector768.nearestNeighbors(vector, count)
      1024 -> LoreVectorRecord_.vector1024.nearestNeighbors(vector, count)
      1536 -> LoreVectorRecord_.vector1536.nearestNeighbors(vector, count)
      4096 -> LoreVectorRecord_.vector4096.nearestNeighbors(vector, count)
      else -> throw IllegalArgumentException("Dimension ObjectBox non supportée: ${vector.size}")
    }
    return box.query(condition.and(LoreVectorRecord_.namespace.equal(namespace))).build()
  }

  private fun historyQuery(
    box: Box<HistoryVectorRecord>,
    storyId: String,
    vector: FloatArray,
    maxCount: Int,
  ): Query<HistoryVectorRecord> {
    val count = maxCount.coerceIn(1, 100)
    val condition = when (vector.size) {
      384 -> HistoryVectorRecord_.vector384.nearestNeighbors(vector, count)
      768 -> HistoryVectorRecord_.vector768.nearestNeighbors(vector, count)
      1024 -> HistoryVectorRecord_.vector1024.nearestNeighbors(vector, count)
      1536 -> HistoryVectorRecord_.vector1536.nearestNeighbors(vector, count)
      4096 -> HistoryVectorRecord_.vector4096.nearestNeighbors(vector, count)
      else -> throw IllegalArgumentException("Dimension ObjectBox non supportée: ${vector.size}")
    }
    return box.query(condition.and(HistoryVectorRecord_.storyId.equal(storyId))).build()
  }

  private fun searchLore(store: BoxStore, namespace: String, vector: FloatArray, maxCount: Int): JSONArray {
    val box = store.boxFor(LoreVectorRecord::class.java)
    val query = loreQuery(box, namespace, vector, maxCount)
    val results = try { query.findWithScores() } finally { query.close() }
    val json = JSONArray()
    for (result in results) {
      val item = result.get()
      json.put(JSONObject().put("id", item.externalId).put("score", 1.0 - result.score.toDouble()))
    }
    return json
  }

  private fun searchHistory(store: BoxStore, storyId: String, vector: FloatArray, maxCount: Int): JSONArray {
    val box = store.boxFor(HistoryVectorRecord::class.java)
    val query = historyQuery(box, storyId, vector, maxCount)
    val results = try { query.findWithScores() } finally { query.close() }
    val json = JSONArray()
    for (result in results) {
      val item = result.get()
      json.put(JSONObject().put("id", item.externalId).put("score", 1.0 - result.score.toDouble()))
    }
    return json
  }

  private fun removeLoreNamespace(box: Box<LoreVectorRecord>, namespace: String) {
    val query = box.query(LoreVectorRecord_.namespace.equal(namespace)).build()
    val ids = try { query.findIds() } finally { query.close() }
    for (id in ids) box.remove(id)
  }

  private fun removeHistoryStory(box: Box<HistoryVectorRecord>, storyId: String) {
    val query = box.query(HistoryVectorRecord_.storyId.equal(storyId)).build()
    val ids = try { query.findIds() } finally { query.close() }
    for (id in ids) box.remove(id)
  }
}
