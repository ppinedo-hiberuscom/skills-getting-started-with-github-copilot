"""
Tests for the Mergington High School Activities API
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from app import app, activities


@pytest.fixture(autouse=True)
def reset_activities():
    """Reset activities to a clean state before each test."""
    original = {
        name: {**details, "participants": list(details["participants"])}
        for name, details in activities.items()
    }
    yield
    activities.clear()
    activities.update(original)


client = TestClient(app)


class TestGetActivities:
    def test_get_activities_returns_200(self):
        # Arrange & Act
        response = client.get("/activities")

        # Assert
        assert response.status_code == 200

    def test_get_activities_returns_dict(self):
        # Arrange & Act
        response = client.get("/activities")
        data = response.json()

        # Assert
        assert isinstance(data, dict)

    def test_get_activities_contains_expected_keys(self):
        # Arrange & Act
        response = client.get("/activities")
        data = response.json()

        # Assert
        for activity in data.values():
            assert "description" in activity
            assert "schedule" in activity
            assert "max_participants" in activity
            assert "participants" in activity

    def test_get_activities_has_at_least_four_activities(self):
        # Arrange & Act
        response = client.get("/activities")
        data = response.json()

        # Assert
        assert len(data) >= 4


class TestSignupForActivity:
    def test_signup_returns_200(self):
        # Arrange
        activity_name = "Chess Club"
        email = "newstudent@mergington.edu"

        # Act
        response = client.post(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 200

    def test_signup_adds_student_to_participants(self):
        # Arrange
        activity_name = "Chess Club"
        email = "newstudent@mergington.edu"

        # Act
        client.post(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert email in activities[activity_name]["participants"]

    def test_signup_returns_success_message(self):
        # Arrange
        activity_name = "Chess Club"
        email = "newstudent@mergington.edu"

        # Act
        response = client.post(f"/activities/{activity_name}/signup?email={email}")
        data = response.json()

        # Assert
        assert "message" in data
        assert email in data["message"]

    def test_signup_invalid_activity_returns_404(self):
        # Arrange
        activity_name = "Nonexistent Activity"
        email = "student@mergington.edu"

        # Act
        response = client.post(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 404

    def test_signup_duplicate_returns_400(self):
        # Arrange
        activity_name = "Chess Club"
        email = "michael@mergington.edu"  # already signed up

        # Act
        response = client.post(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 400


class TestUnregisterFromActivity:
    def test_unregister_returns_200(self):
        # Arrange
        activity_name = "Chess Club"
        email = "michael@mergington.edu"

        # Act
        response = client.delete(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 200

    def test_unregister_removes_student(self):
        # Arrange
        activity_name = "Chess Club"
        email = "michael@mergington.edu"

        # Act
        client.delete(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert email not in activities[activity_name]["participants"]

    def test_unregister_invalid_activity_returns_404(self):
        # Arrange
        activity_name = "Nonexistent Activity"
        email = "student@mergington.edu"

        # Act
        response = client.delete(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 404

    def test_unregister_not_signed_up_returns_404(self):
        # Arrange
        activity_name = "Chess Club"
        email = "notsignedup@mergington.edu"

        # Act
        response = client.delete(f"/activities/{activity_name}/signup?email={email}")

        # Assert
        assert response.status_code == 404
