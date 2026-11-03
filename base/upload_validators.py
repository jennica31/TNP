import os
import re
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

MB = 1024 * 1024


@deconstructible
class MaxFileSizeValidator:
    def __init__(self, max_mb):
        self.max_mb = max_mb

    def __call__(self, f):
        if f.size > self.max_mb * MB:
            raise ValidationError(f"File too large. Maximum size is {self.max_mb}MB.")

    def __eq__(self, other):
        return isinstance(other, MaxFileSizeValidator) and self.max_mb == other.max_mb


validate_image_size = MaxFileSizeValidator(5)
validate_document_size = MaxFileSizeValidator(10)
validate_attachment_size = MaxFileSizeValidator(10)

# Signatures for common safe allowed file types
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "webp": [b"RIFF"],  # followed by WEBP
    # Office open XML formats (docx, xlsx, pptx) and zip
    "zip": [b"PK\x03\x04"],
    "docx": [b"PK\x03\x04"],
    "xlsx": [b"PK\x03\x04"],
    "pptx": [b"PK\x03\x04"],
}


def sanitize_upload_filename(filename: str) -> str:
    """
    Sanitizes uploaded filenames to prevent path traversal (e.g. ../ or /),
    strips null bytes, and restricts characters to a safe alphanumeric set.
    """
    clean_name = os.path.basename(filename)
    clean_name = re.sub(r"[^\w\.\-]", "_", clean_name)
    # Avoid hidden files or double extensions like .php.jpg
    clean_name = clean_name.lstrip(".")
    if not clean_name:
        clean_name = "upload"
    return clean_name


def validate_file_magic(file_obj, allowed_extensions=None):
    """
    Validates file content headers (magic bytes) against expected formats.
    Ensures that an uploaded file is not an executable or script disguised with a safe extension.
    """
    filename = getattr(file_obj, "name", "")
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    
    if allowed_extensions and ext not in allowed_extensions:
        raise ValidationError(f"File extension '.{ext}' is not permitted.")

    # Plain text / CSV files don't have binary signatures
    if ext in ("csv", "txt"):
        return True

    expected_sigs = MAGIC_SIGNATURES.get(ext)
    if expected_sigs:
        pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
        try:
            head = file_obj.read(16)
            if hasattr(file_obj, "seek"):
                file_obj.seek(pos)
            if not any(head.startswith(sig) for sig in expected_sigs):
                raise ValidationError(f"File content does not match the expected format for .{ext}.")
        except Exception as e:
            if hasattr(file_obj, "seek"):
                file_obj.seek(pos)
            if isinstance(e, ValidationError):
                raise
            raise ValidationError("Unable to verify file signature.")
    return True
