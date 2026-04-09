"""
Iteration 55: Gallery Upload Tests
Tests for POST /api/gallery/upload, DELETE /api/gallery/{index}, GET /api/files/{path}
Features: multipart file upload, file extension validation, photo/video type detection, object storage
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def trainer_auth():
    """Login as trainer and return token + user_id"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    assert resp.status_code == 200, f"Trainer login failed: {resp.text}"
    data = resp.json()
    return {
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"}
    }


@pytest.fixture(scope="module")
def trainee_auth():
    """Login as trainee and return token + user_id"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    assert resp.status_code == 200, f"Trainee login failed: {resp.text}"
    data = resp.json()
    return {
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"}
    }


def create_test_image_bytes():
    """Create a minimal valid PNG image (1x1 pixel)"""
    # Minimal PNG: 1x1 red pixel
    png_bytes = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,  # compressed data
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    return png_bytes


def create_test_jpeg_bytes():
    """Create minimal JPEG bytes"""
    # Minimal valid JPEG (1x1 pixel)
    jpeg_bytes = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
        0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
        0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
        0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
        0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
        0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
        0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
        0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
        0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
        0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
        0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
        0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
        0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
        0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
        0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
        0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
        0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
        0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
        0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
        0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
        0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
        0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
        0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
        0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
        0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
        0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xB4,
        0x01, 0xFF, 0xD9
    ])
    return jpeg_bytes


class TestGalleryUploadAuth:
    """Test authentication requirements for gallery upload"""
    
    def test_upload_requires_auth(self):
        """POST /api/gallery/upload should require authentication"""
        files = {"file": ("test.png", create_test_image_bytes(), "image/png")}
        resp = requests.post(f"{BASE_URL}/api/gallery/upload", files=files)
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print("PASS: Upload requires authentication")
    
    def test_upload_with_invalid_token(self):
        """POST /api/gallery/upload should reject invalid token"""
        files = {"file": ("test.png", create_test_image_bytes(), "image/png")}
        headers = {"Authorization": "Bearer invalid_token_12345"}
        resp = requests.post(f"{BASE_URL}/api/gallery/upload", files=files, headers=headers)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print("PASS: Upload rejects invalid token")


class TestGalleryUploadValidation:
    """Test file validation for gallery upload"""
    
    def test_upload_rejects_txt_file(self, trainer_auth):
        """POST /api/gallery/upload should reject .txt files"""
        files = {"file": ("test.txt", b"This is a text file", "text/plain")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "Unsupported file type" in resp.text or "txt" in resp.text.lower()
        print("PASS: Upload rejects .txt files")
    
    def test_upload_rejects_pdf_file(self, trainer_auth):
        """POST /api/gallery/upload should reject .pdf files"""
        files = {"file": ("document.pdf", b"%PDF-1.4 fake pdf content", "application/pdf")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PASS: Upload rejects .pdf files")
    
    def test_upload_rejects_exe_file(self, trainer_auth):
        """POST /api/gallery/upload should reject .exe files"""
        files = {"file": ("malware.exe", b"MZ fake exe content", "application/octet-stream")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PASS: Upload rejects .exe files")


class TestGalleryUploadSuccess:
    """Test successful gallery uploads"""
    
    def test_upload_png_image(self, trainer_auth):
        """POST /api/gallery/upload should accept PNG images"""
        files = {"file": ("test_image.png", create_test_image_bytes(), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert "item" in data
        assert data["item"]["type"] == "photo"
        assert "url" in data["item"]
        assert data["item"]["url"].startswith("/api/files/")
        assert "storagePath" in data["item"]
        print(f"PASS: PNG upload successful, url={data['item']['url']}")
        return data["item"]
    
    def test_upload_jpeg_image(self, trainer_auth):
        """POST /api/gallery/upload should accept JPEG images"""
        files = {"file": ("test_image.jpg", create_test_jpeg_bytes(), "image/jpeg")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert data["item"]["type"] == "photo"
        assert data["mediaType"] == "photo"
        print(f"PASS: JPEG upload successful")
    
    def test_upload_with_caption(self, trainer_auth):
        """POST /api/gallery/upload should accept caption parameter"""
        files = {"file": ("captioned.png", create_test_image_bytes(), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            params={"caption": "My workout photo"},
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert data["item"].get("caption") == "My workout photo"
        print("PASS: Upload with caption successful")
    
    def test_upload_video_extension_detection(self, trainer_auth):
        """POST /api/gallery/upload should detect video type from .mp4 extension"""
        # Create minimal fake mp4 bytes (just for extension testing)
        fake_mp4 = b"\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d" + b"\x00" * 100
        files = {"file": ("test_video.mp4", fake_mp4, "video/mp4")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert data["item"]["type"] == "video"
        assert data["mediaType"] == "video"
        print("PASS: Video type detection from .mp4 extension")
    
    def test_upload_mov_video(self, trainer_auth):
        """POST /api/gallery/upload should accept .mov video files"""
        fake_mov = b"\x00\x00\x00\x14\x66\x74\x79\x70\x71\x74\x20\x20" + b"\x00" * 100
        files = {"file": ("test_video.mov", fake_mov, "video/quicktime")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["item"]["type"] == "video"
        print("PASS: .mov video upload successful")


class TestGalleryItemStructure:
    """Test that gallery items have correct structure"""
    
    def test_gallery_item_has_required_fields(self, trainer_auth):
        """Gallery item should have url, type, and storagePath fields"""
        files = {"file": ("structure_test.png", create_test_image_bytes(), "image/png")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        item = data["item"]
        
        # Check required fields
        assert "url" in item, "Gallery item missing 'url' field"
        assert "type" in item, "Gallery item missing 'type' field"
        assert "storagePath" in item, "Gallery item missing 'storagePath' field"
        
        # Validate field values
        assert item["url"].startswith("/api/files/"), f"URL should start with /api/files/, got {item['url']}"
        assert item["type"] in ["photo", "video"], f"Type should be photo or video, got {item['type']}"
        assert len(item["storagePath"]) > 0, "storagePath should not be empty"
        
        print(f"PASS: Gallery item has all required fields: url={item['url']}, type={item['type']}, storagePath={item['storagePath']}")


class TestFileServing:
    """Test GET /api/files/{path} endpoint"""
    
    def test_serve_uploaded_file(self, trainer_auth):
        """GET /api/files/{path} should serve uploaded file with correct content-type"""
        # First upload a file
        image_bytes = create_test_image_bytes()
        files = {"file": ("serve_test.png", image_bytes, "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        
        # Get the file URL
        file_url = upload_resp.json()["item"]["url"]
        
        # Fetch the file
        serve_resp = requests.get(f"{BASE_URL}{file_url}")
        assert serve_resp.status_code == 200, f"Expected 200, got {serve_resp.status_code}: {serve_resp.text}"
        
        # Check content-type
        content_type = serve_resp.headers.get("Content-Type", "")
        assert "image" in content_type.lower(), f"Expected image content-type, got {content_type}"
        
        # Check content is returned
        assert len(serve_resp.content) > 0, "File content should not be empty"
        
        print(f"PASS: File served successfully with content-type={content_type}")
    
    def test_serve_nonexistent_file(self):
        """GET /api/files/{path} should return 404 for nonexistent file"""
        resp = requests.get(f"{BASE_URL}/api/files/nonexistent/path/file.png")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("PASS: 404 returned for nonexistent file")


class TestGalleryDelete:
    """Test DELETE /api/gallery/{index} endpoint"""
    
    def test_delete_gallery_item(self, trainer_auth):
        """DELETE /api/gallery/{index} should remove item from gallery"""
        # First upload a file to have something to delete
        files = {"file": ("delete_test.png", create_test_image_bytes(), "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        
        # Get current gallery to find the index
        profile_resp = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
            headers=trainer_auth["headers"]
        )
        assert profile_resp.status_code == 200, f"Get profile failed: {profile_resp.text}"
        gallery = profile_resp.json().get("gallery", [])
        
        if len(gallery) == 0:
            pytest.skip("No gallery items to delete")
        
        # Delete the last item
        last_index = len(gallery) - 1
        delete_resp = requests.delete(
            f"{BASE_URL}/api/gallery/{last_index}",
            headers=trainer_auth["headers"]
        )
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}: {delete_resp.text}"
        data = delete_resp.json()
        assert data.get("success") is True
        
        # Verify gallery is updated
        assert "gallery" in data
        assert len(data["gallery"]) == last_index  # One less item
        
        print(f"PASS: Gallery item at index {last_index} deleted successfully")
    
    def test_delete_invalid_index(self, trainer_auth):
        """DELETE /api/gallery/{index} should reject invalid index"""
        # Try to delete at a very high index
        resp = requests.delete(
            f"{BASE_URL}/api/gallery/9999",
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("PASS: Delete rejects invalid index")
    
    def test_delete_negative_index(self, trainer_auth):
        """DELETE /api/gallery/{index} should reject negative index"""
        resp = requests.delete(
            f"{BASE_URL}/api/gallery/-1",
            headers=trainer_auth["headers"]
        )
        # Could be 400 or 422 depending on validation
        assert resp.status_code in [400, 422], f"Expected 400/422, got {resp.status_code}: {resp.text}"
        print("PASS: Delete rejects negative index")
    
    def test_delete_requires_auth(self):
        """DELETE /api/gallery/{index} should require authentication"""
        resp = requests.delete(f"{BASE_URL}/api/gallery/0")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("PASS: Delete requires authentication")


class TestGalleryPersistence:
    """Test that uploaded files are persisted to MongoDB gallery array"""
    
    def test_upload_appends_to_trainer_gallery(self, trainer_auth):
        """Uploaded file should be appended to trainer_profiles gallery array"""
        # Get initial gallery count
        profile_resp = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
            headers=trainer_auth["headers"]
        )
        assert profile_resp.status_code == 200, f"Get profile failed: {profile_resp.text}"
        initial_gallery = profile_resp.json().get("gallery", [])
        initial_count = len(initial_gallery)
        
        # Upload a new file
        files = {"file": ("persist_test.png", create_test_image_bytes(), "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        uploaded_item = upload_resp.json()["item"]
        
        # Verify gallery was updated
        profile_resp2 = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
            headers=trainer_auth["headers"]
        )
        assert profile_resp2.status_code == 200
        updated_gallery = profile_resp2.json().get("gallery", [])
        
        assert len(updated_gallery) == initial_count + 1, f"Gallery should have {initial_count + 1} items, got {len(updated_gallery)}"
        
        # Verify the last item matches what was uploaded
        last_item = updated_gallery[-1]
        assert last_item["url"] == uploaded_item["url"]
        assert last_item["type"] == uploaded_item["type"]
        assert last_item["storagePath"] == uploaded_item["storagePath"]
        
        print(f"PASS: Upload appended to gallery (now {len(updated_gallery)} items)")


class TestAllowedExtensions:
    """Test all allowed image and video extensions"""
    
    @pytest.mark.parametrize("ext,expected_type", [
        ("jpg", "photo"),
        ("jpeg", "photo"),
        ("png", "photo"),
        ("gif", "photo"),
        ("webp", "photo"),
        ("heic", "photo"),
    ])
    def test_allowed_image_extensions(self, trainer_auth, ext, expected_type):
        """Test that all allowed image extensions are accepted"""
        files = {"file": (f"test.{ext}", create_test_image_bytes(), f"image/{ext}")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200 for .{ext}, got {resp.status_code}: {resp.text}"
        assert resp.json()["item"]["type"] == expected_type
        print(f"PASS: .{ext} extension accepted as {expected_type}")
    
    @pytest.mark.parametrize("ext,expected_type", [
        ("mp4", "video"),
        ("mov", "video"),
        ("avi", "video"),
        ("mkv", "video"),
    ])
    def test_allowed_video_extensions(self, trainer_auth, ext, expected_type):
        """Test that all allowed video extensions are accepted"""
        fake_video = b"\x00" * 100  # Minimal bytes for extension test
        files = {"file": (f"test.{ext}", fake_video, f"video/{ext}")}
        resp = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers=trainer_auth["headers"]
        )
        assert resp.status_code == 200, f"Expected 200 for .{ext}, got {resp.status_code}: {resp.text}"
        assert resp.json()["item"]["type"] == expected_type
        print(f"PASS: .{ext} extension accepted as {expected_type}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
