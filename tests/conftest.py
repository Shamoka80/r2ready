
import pytest
import os
import tempfile
from unittest.mock import Mock, patch

# Test configuration
@pytest.fixture(scope="session")
def test_config():
    """Global test configuration"""
    return {
        "test_db_url": "sqlite:///:memory:",
        "api_timeout": 5,
        "test_data_dir": "tests/fixtures"
    }

@pytest.fixture
def mock_database():
    """Mock database connection"""
    mock_db = Mock()
    mock_db.execute.return_value = Mock()
    mock_db.fetchall.return_value = []
    mock_db.fetchone.return_value = None
    return mock_db

@pytest.fixture
def temp_file():
    """Create temporary file for testing"""
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as f:
        yield f.name
    os.unlink(f.name)

@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        "id": 1,
        "username": "testuser",
        "email": "test@example.com",
        "created_at": "2023-01-01T00:00:00Z"
    }

@pytest.fixture(autouse=True)
def clean_environment():
    """Clean environment variables before each test"""
    original_env = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(original_env)
