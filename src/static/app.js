document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const submitButton = signupForm.querySelector('button[type="submit"]');
  const ACTIVITIES_STORAGE_KEY = "mergington.activities.cache";

  let activitiesCache = {};

  function saveActivitiesToStorage(activities) {
    try {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
    } catch (error) {
      // Ignore storage errors (private mode, quota exceeded, etc).
      console.warn("Could not persist activities cache:", error);
    }
  }

  function loadActivitiesFromStorage() {
    try {
      const raw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return null;
    } catch (error) {
      console.warn("Could not read activities cache:", error);
      return null;
    }
  }

  function renderActivities(activities) {
    // Clear loading message and refresh select options.
    activitiesList.innerHTML = "";
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    Object.entries(activities).forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";
      activityCard.dataset.activityName = name;

      const spotsLeft = details.max_participants - details.participants.length;
      const participantItems = details.participants.length
        ? details.participants
            .map(
              (participant) => `
                <li class="participant-item">
                  <span class="participant-email">${participant}</span>
                  <button
                    type="button"
                    class="participant-delete-button"
                    data-activity="${name}"
                    data-email="${participant}"
                    aria-label="Unregister ${participant} from ${name}"
                    title="Unregister participant"
                  >
                    <span aria-hidden="true">x</span>
                  </button>
                </li>
              `
            )
            .join("")
        : '<li class="empty">No participants yet</li>';

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-section">
          <p class="participants-title">Participants:</p>
          <ul class="participants-list">
            ${participantItems}
          </ul>
        </div>
      `;

      activitiesList.appendChild(activityCard);

      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function applyOptimisticSignup(activityName, email) {
    const activity = activitiesCache[activityName];
    if (!activity) {
      return;
    }

    if (!activity.participants.includes(email)) {
      activity.participants.push(email);
      renderActivities(activitiesCache);
      saveActivitiesToStorage(activitiesCache);
    }
  }

  function applyOptimisticUnregister(activityName, email) {
    const activity = activitiesCache[activityName];
    if (!activity) {
      return;
    }

    activity.participants = activity.participants.filter((participant) => participant !== email);
    renderActivities(activitiesCache);
    saveActivitiesToStorage(activitiesCache);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities", {
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      activitiesCache = await response.json();
      renderActivities(activitiesCache);
      saveActivitiesToStorage(activitiesCache);
    } catch (error) {
      if (!Object.keys(activitiesCache).length) {
        activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      }
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    submitButton.disabled = true;
    submitButton.textContent = "Signing up...";

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        applyOptimisticSignup(activity, email);
        signupForm.reset();

        // Sync with source of truth in background.
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Sign Up";
    }
  });

  activitiesList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".participant-delete-button");
    if (!deleteButton) {
      return;
    }

    const { activity, email } = deleteButton.dataset;
    if (!activity || !email) {
      return;
    }

    deleteButton.disabled = true;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        applyOptimisticUnregister(activity, email);
        fetchActivities();
      } else {
        showMessage(result.detail || "Failed to unregister participant.", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister participant. Please try again.", "error");
      console.error("Error unregistering participant:", error);
    } finally {
      deleteButton.disabled = false;
    }
  });

  // Initialize app
  const cachedActivities = loadActivitiesFromStorage();
  if (cachedActivities) {
    activitiesCache = cachedActivities;
    renderActivities(activitiesCache);
  }

  fetchActivities();
});
