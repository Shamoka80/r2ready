
import pytest
from unittest.mock import Mock, patch, MagicMock

class TestUserService:
    """Example test class demonstrating testing patterns"""
    
    def test_user_creation_happy_path(self, sample_user_data):
        """Test successful user creation"""
        # Arrange
        user_service = UserService()
        
        # Act
        result = user_service.create_user(sample_user_data)
        
        # Assert
        assert result is not None
        assert result["username"] == "testuser"
        assert result["email"] == "test@example.com"
    
    def test_user_creation_invalid_email(self):
        """Test user creation with invalid email"""
        # Arrange
        user_service = UserService()
        invalid_data = {"username": "test", "email": "invalid-email"}
        
        # Act & Assert
        with pytest.raises(ValueError, match="Invalid email format"):
            user_service.create_user(invalid_data)
    
    @pytest.mark.parametrize("username,expected", [
        ("validuser", True),
        ("a", False),  # too short
        ("", False),   # empty
        ("user@123", False),  # invalid chars
    ])
    def test_username_validation(self, username, expected):
        """Test username validation with multiple scenarios"""
        user_service = UserService()
        result = user_service.validate_username(username)
        assert result == expected
    
    @patch('requests.get')
    def test_external_api_call(self, mock_get):
        """Test external API integration with mocking"""
        # Arrange
        mock_response = Mock()
        mock_response.json.return_value = {"status": "success"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        user_service = UserService()
        
        # Act
        result = user_service.fetch_user_data(user_id=1)
        
        # Assert
        mock_get.assert_called_once_with("https://api.example.com/users/1")
        assert result["status"] == "success"
    
    def test_database_operation(self, mock_database):
        """Test database operations with mocked database"""
        # Arrange
        mock_database.fetchone.return_value = {"id": 1, "username": "testuser"}
        user_service = UserService(database=mock_database)
        
        # Act
        result = user_service.get_user_by_id(1)
        
        # Assert
        mock_database.execute.assert_called_once()
        assert result["username"] == "testuser"

# Example service class (would be in your main code)
class UserService:
    def __init__(self, database=None):
        self.database = database
    
    def create_user(self, user_data):
        if not self._validate_email(user_data.get("email")):
            raise ValueError("Invalid email format")
        return user_data
    
    def validate_username(self, username):
        return len(username) >= 3 and username.isalnum()
    
    def _validate_email(self, email):
        return "@" in email and "." in email
    
    def fetch_user_data(self, user_id):
        import requests
        response = requests.get(f"https://api.example.com/users/{user_id}")
        return response.json()
    
    def get_user_by_id(self, user_id):
        self.database.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return self.database.fetchone()
