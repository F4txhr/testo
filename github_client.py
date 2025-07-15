# github_client.py
import requests
import base64
import json

class GitHubClient:
    """Kelas untuk berinteraksi dengan GitHub API v3."""
    def __init__(self, token: str, owner: str, repo: str):
        self.token = token
        self.owner = owner
        self.repo = repo
        self.api_url = f"https://api.github.com/repos/{owner}/{repo}/contents"
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def list_files_in_repo(self, path: str = "") -> list:
        """Mendapatkan daftar file dari path tertentu di repo."""
        url = f"{self.api_url}/{path}"
        try:
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status() # Akan raise error jika status bukan 2xx
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Gagal mengambil daftar file dari GitHub: {e}")
            return []

    def get_file(self, file_path: str) -> tuple[str, str] | None:
        """Mendapatkan konten dan SHA dari sebuah file di repo."""
        url = f"{self.api_url}/{file_path}"
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            content = base64.b64decode(data['content']).decode('utf-8')
            return content, data['sha']
        except requests.exceptions.RequestException as e:
            print(f"❌ Gagal mengambil file '{file_path}': {e}")
            return None, None

    def update_or_create_file(self, file_path: str, content: str, commit_message: str, sha: str = None):
        """Membuat file baru atau mengupdate file yang sudah ada."""
        url = f"{self.api_url}/{file_path}"
        encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        payload = {"message": commit_message, "content": encoded_content}
        if sha:
            payload['sha'] = sha
        
        try:
            response = requests.put(url, headers=self.headers, data=json.dumps(payload), timeout=15)
            response.raise_for_status()
            print(f"✔️ Berhasil menyimpan file '{file_path}' ke GitHub.")
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Gagal menyimpan ke GitHub: {e}")
            return None
