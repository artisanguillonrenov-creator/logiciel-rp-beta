"""Petit serveur de dépôt pour les pods d'entraînement.

Les données d'entraînement (contenu adulte) ne passent pas par le dépôt
GitHub public : elles sont envoyées directement au pod (PUT) sous un chemin
secret, et les résultats (journaux, modèles) y sont relus (GET).

Usage : python3 serveur_depot.py <port> <dossier> <jeton>
"""
import http.server
import os
import sys

PORT, DOSSIER, JETON = int(sys.argv[1]), sys.argv[2], sys.argv[3]


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER, **kwargs)

    def _chemin_autorise(self):
        prefixe = f"/{JETON}/"
        if not self.path.startswith(prefixe):
            self.send_error(404)
            return None
        nom = os.path.basename(self.path[len(prefixe):].split("?")[0])
        if not nom or nom.startswith("."):
            self.send_error(400)
            return None
        return os.path.join(DOSSIER, nom)

    def do_GET(self):
        chemin = self._chemin_autorise()
        if chemin is None:
            return
        self.path = "/" + os.path.basename(chemin)
        super().do_GET()

    def do_PUT(self):
        chemin = self._chemin_autorise()
        if chemin is None:
            return
        reste = int(self.headers.get("Content-Length", 0))
        with open(chemin + ".partiel", "wb") as f:
            while reste > 0:
                bloc = self.rfile.read(min(reste, 1 << 20))
                if not bloc:
                    break
                f.write(bloc)
                reste -= len(bloc)
        os.replace(chemin + ".partiel", chemin)
        self.send_response(201)
        self.end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None


http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Gestionnaire).serve_forever()
