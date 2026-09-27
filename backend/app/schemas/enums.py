from enum import Enum


class Impact(str, Enum):
    PATIENT_SAFETY = "Patient Safety"
    PRODUCT_QUALITY = "Product Quality"
    REGULATORY = "Regulatory"
    DOCUMENTATION = "Documentation"


class Severity(str, Enum):
    CRITICAL = "Critical"
    MAJOR = "Major"
    MINOR = "Minor"


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    LOW = "low"


# Fields the AI extraction step populates on the Deviation form.
EXTRACTED_FIELDS = [
    "site_plant",
    "date_of_occurrence",
    "title",
    "source",
    "related_product",
    "batch_lot_number",
    "detailed_description",
]

# Fields required for validate_node to consider a deviation complete enough to save.
REQUIRED_FIELDS = ["site_plant", "date_of_occurrence", "title", "source"]

# All fields tracked in the AI-vs-human audit diff (extraction fields + assessment fields).
TRACKED_FIELDS = EXTRACTED_FIELDS + ["initial_impact", "initial_severity"]
