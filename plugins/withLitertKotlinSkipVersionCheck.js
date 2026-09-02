const { withProjectBuildGradle, CodeGenerator } = require('@expo/config-plugins');
const { mergeContents } = CodeGenerator;

// litertlm-android:0.11.0 (dépendance native de expo-litert-lm) est
// compilée avec une version de Kotlin plus récente que celle utilisée par
// défaut pour le reste du projet, ce qui fait échouer la lecture de ses
// classes ("was compiled with an incompatible version of Kotlin").
// Forcer une version de Kotlin plus récente pour TOUT le projet a cassé la
// compilation de react-native-gesture-handler à plusieurs reprises
// (versions testées : 2.2.0, 2.3.0, 2.3.21 — voir historique de commits).
//
// Solution plus ciblée : on ne touche pas à la version de Kotlin globale
// (react-native-gesture-handler reste sur la version par défaut, connue
// pour fonctionner), et on ajoute -Xskip-metadata-version-check
// uniquement aux tâches de compilation Kotlin du module expo-litert-lm —
// ce flag est prévu exactement pour ce cas (bibliothèque précompilée avec
// un Kotlin plus récent que le compilateur du projet consommateur).
const SNIPPET = `
subprojects { subproject ->
  if (subproject.name == 'expo-litert-lm') {
    subproject.afterEvaluate {
      subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
          freeCompilerArgs += ["-Xskip-metadata-version-check"]
        }
      }
    }
  }
}
`;

const withLitertKotlinSkipVersionCheck = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withLitertKotlinSkipVersionCheck attend un build.gradle Groovy.');
    }
    config.modResults.contents = mergeContents({
      src: config.modResults.contents,
      newSrc: SNIPPET,
      tag: 'expo-litert-lm-kotlin-skip-version-check',
      anchor: /^allprojects\s*\{/m,
      offset: 0,
      comment: '//',
    }).contents;
    return config;
  });
};

module.exports = withLitertKotlinSkipVersionCheck;
