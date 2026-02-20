 // app.js
 // Front-end logic for the GenAI Social Match Maker
 
 const form = document.getElementById("preferences-form");
 const relationshipTypeSelect = document.getElementById("relationship-type");
 const preferencesTextarea = document.getElementById("preferences");
 const statusMessage = document.getElementById("status-message");
 const errorBanner = document.getElementById("error-banner");
 const profilesContainer = document.getElementById("profiles-container");
 const refineSection = document.getElementById("refine-section");
 const refineForm = document.getElementById("refine-form");
 const refineInput = document.getElementById("refine-input");
const refineStatus = document.getElementById("refine-status");

let currentProfiles = [];
let selectedProfileId = null;

function buildAvatarSeed(profile) {
    const name = profile.name || `Profile ${profile.id}`;
    const rel = profile.relationship_type || "";
    const interests = Array.isArray(profile.interests)
        ? profile.interests.join(", ")
        : profile.interests || "";
    return `${name} | ${rel} | ${interests}`.slice(0, 120);
}

function getAvatarUrl(profile) {
    const seed = encodeURIComponent(buildAvatarSeed(profile));
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50`;
}
 
 function setStatus(message, isLoading = false) {
     statusMessage.textContent = message || "";
     if (isLoading) {
         statusMessage.classList.add("status-loading");
     } else {
         statusMessage.classList.remove("status-loading");
     }
 }
 
 function setRefineStatus(message, isLoading = false) {
     refineStatus.textContent = message || "";
     if (isLoading) {
         refineStatus.classList.add("status-loading");
     } else {
         refineStatus.classList.remove("status-loading");
     }
 }
 
 function showError(message) {
     errorBanner.textContent = message;
     errorBanner.hidden = false;
 }
 
 function clearError() {
     errorBanner.textContent = "";
     errorBanner.hidden = true;
 }
 
 function renderProfiles(profiles) {
     profilesContainer.classList.remove("empty-state");
     profilesContainer.innerHTML = "";
 
     profiles.forEach((profile) => {
         const card = document.createElement("article");
         card.className = "profile-card";
         card.dataset.profileId = profile.id;
 
        const header = document.createElement("header");
        header.className = "profile-header";

        const avatar = document.createElement("img");
        avatar.className = "profile-avatar";
        avatar.src = getAvatarUrl(profile);
        avatar.alt = `Avatar for ${profile.name || `profile ${profile.id}`}`;
        avatar.loading = "lazy";

        const headerText = document.createElement("div");
        headerText.className = "profile-header-text";
        const title = document.createElement("h3");
        title.textContent = profile.name || `Profile ${profile.id}`;
        const subtitle = document.createElement("p");
        const age = profile.age ? `${profile.age}` : "age unknown";
        const location = profile.location || "location unknown";
        subtitle.textContent = `${age} • ${location}`;
        headerText.appendChild(title);
        headerText.appendChild(subtitle);

        header.appendChild(avatar);
        header.appendChild(headerText);
 
         const badge = document.createElement("p");
         badge.className = "profile-badge";
         badge.textContent = profile.relationship_type || "Match";
 
         const body = document.createElement("div");
         body.className = "profile-body";
 
         const personality = document.createElement("p");
         personality.innerHTML = `<strong>Personality:</strong> ${profile.personality || "N/A"}`;
 
         const interests = document.createElement("p");
         const interestsList = Array.isArray(profile.interests) ? profile.interests.join(", ") : profile.interests || "N/A";
         interests.innerHTML = `<strong>Interests:</strong> ${interestsList}`;
 
         const goals = document.createElement("p");
         goals.innerHTML = `<strong>Relationship goals:</strong> ${profile.relationship_goals || "N/A"}`;
 
         const backstory = document.createElement("p");
         backstory.innerHTML = `<strong>Backstory:</strong> ${profile.backstory || "N/A"}`;
 
         const whyMatch = document.createElement("p");
         whyMatch.innerHTML = `<strong>Why this might fit you:</strong> ${profile.why_a_good_match || "N/A"}`;
 
         body.appendChild(personality);
         body.appendChild(interests);
         body.appendChild(goals);
         body.appendChild(backstory);
         body.appendChild(whyMatch);
 
         const actions = document.createElement("div");
         actions.className = "profile-actions";
         const chooseButton = document.createElement("button");
         chooseButton.type = "button";
         chooseButton.className = "btn btn-outline";
         chooseButton.textContent = "Choose this profile to refine";
         chooseButton.addEventListener("click", () => {
             selectProfile(profile.id);
         });
         actions.appendChild(chooseButton);
 
         card.appendChild(header);
         card.appendChild(badge);
         card.appendChild(body);
         card.appendChild(actions);
 
         profilesContainer.appendChild(card);
     });
 }
 
 function selectProfile(profileId) {
     selectedProfileId = profileId;
 
     document
         .querySelectorAll(".profile-card")
         .forEach((card) => card.classList.remove("profile-card-selected"));
 
     const selectedCard = document.querySelector(`.profile-card[data-profile-id="${profileId}"]`);
     if (selectedCard) {
         selectedCard.classList.add("profile-card-selected");
         refineSection.hidden = false;
         refineInput.focus();
     }
 }
 
 async function handleGenerate(event) {
     event.preventDefault();
     clearError();
     setStatus("Generating fictional matches with Ollama…", true);
     setRefineStatus("");
     refineSection.hidden = true;
     selectedProfileId = null;
 
     const relationshipType = relationshipTypeSelect.value;
     const preferences = preferencesTextarea.value.trim();
 
     if (!preferences) {
         setStatus("");
         showError("Please describe what you are looking for before generating matches.");
         return;
     }
 
     try {
         const response = await fetch("/api/profiles", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ relationship_type: relationshipType, preferences }),
         });
 
         const data = await response.json();
 
         if (!response.ok) {
             const message = data.error || "Something went wrong while generating matches.";
             showError(message);
             setStatus("");
             return;
         }
 
         currentProfiles = Array.isArray(data.profiles) ? data.profiles : [];
         if (currentProfiles.length === 0) {
             showError("The model returned an empty list of profiles.");
             setStatus("");
             return;
         }
 
         renderProfiles(currentProfiles);
         setStatus(`Generated ${currentProfiles.length} fictional profiles. Pick one to refine.`);
     } catch (error) {
         console.error(error);
         showError("Network error while talking to the backend. Is the Flask app running?");
         setStatus("");
     }
 }
 
 async function handleRefine(event) {
     event.preventDefault();
     clearError();
     setRefineStatus("Refining the selected profile…", true);
 
     if (!selectedProfileId) {
         setRefineStatus("");
         showError("Please choose a profile card to refine first.");
         return;
     }
 
     const extraInput = refineInput.value.trim();
     if (!extraInput) {
         setRefineStatus("");
         showError("Add a bit of feedback so the model knows what to change.");
         return;
     }
 
     const selectedProfile = currentProfiles.find((p) => p.id === selectedProfileId);
     if (!selectedProfile) {
         setRefineStatus("");
         showError("Could not find the selected profile. Try generating again.");
         return;
     }
 
     try {
         const response = await fetch("/api/refine", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ profile: selectedProfile, extra_input: extraInput }),
         });
 
         const data = await response.json();
 
         if (!response.ok) {
             const message = data.error || "Something went wrong while refining the profile.";
             showError(message);
             setRefineStatus("");
             return;
         }
 
         const refined = data.profile || selectedProfile;
 
         // Update in-memory state and re-render cards so the changes are visible.
         currentProfiles = currentProfiles.map((p) =>
             p.id === selectedProfileId ? refined : p
         );
         renderProfiles(currentProfiles);
         selectProfile(selectedProfileId);
 
         setRefineStatus("Profile refined. You can refine again or adjust your preferences.");
     } catch (error) {
         console.error(error);
         showError("Network error while talking to the backend refine endpoint.");
         setRefineStatus("");
     }
 }
 
 form.addEventListener("submit", handleGenerate);
 refineForm.addEventListener("submit", handleRefine);
 
