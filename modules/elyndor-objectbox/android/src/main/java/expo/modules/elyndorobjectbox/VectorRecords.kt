package expo.modules.elyndorobjectbox

import io.objectbox.annotation.Entity
import io.objectbox.annotation.HnswIndex
import io.objectbox.annotation.Id
import io.objectbox.annotation.Index
import io.objectbox.annotation.VectorDistanceType

/**
 * Espace vectoriel du Lore. Le namespace correspond à une histoire afin
 * d'inclure sans fuite le lore émergent et les plugins propres à la partie.
 * Plusieurs dimensions sont supportées pour ne pas imposer/changer le modèle
 * d'embedding utilisé par Elyndor.
 */
@Entity
data class LoreVectorRecord(
  @Id var id: Long = 0,
  @Index var namespace: String = "",
  @Index var externalId: String = "",
  var contentHash: String = "",
  @HnswIndex(dimensions = 384, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector384: FloatArray? = null,
  @HnswIndex(dimensions = 768, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector768: FloatArray? = null,
  @HnswIndex(dimensions = 1024, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector1024: FloatArray? = null,
  @HnswIndex(dimensions = 1536, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector1536: FloatArray? = null,
  @HnswIndex(dimensions = 4096, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector4096: FloatArray? = null,
)

/**
 * Espace vectoriel de l'Histoire. storyId isole strictement les souvenirs
 * d'une sauvegarde de ceux de toutes les autres histoires.
 */
@Entity
data class HistoryVectorRecord(
  @Id var id: Long = 0,
  @Index var storyId: String = "",
  @Index var externalId: String = "",
  var contentHash: String = "",
  var timestamp: Long = 0,
  @HnswIndex(dimensions = 384, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector384: FloatArray? = null,
  @HnswIndex(dimensions = 768, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector768: FloatArray? = null,
  @HnswIndex(dimensions = 1024, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector1024: FloatArray? = null,
  @HnswIndex(dimensions = 1536, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector1536: FloatArray? = null,
  @HnswIndex(dimensions = 4096, distanceType = VectorDistanceType.COSINE, indexingSearchCount = 200)
  var vector4096: FloatArray? = null,
)
