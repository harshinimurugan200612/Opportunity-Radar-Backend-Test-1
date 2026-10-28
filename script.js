
const $ = (selector) => document.querySelector(selector);

const firebaseConfig = {
  apiKey: "AIzaSyDMqFwMao50LyqU0LcJrLb-5INAFegZkaU",
  authDomain: "opportunity-radar-e2f82.firebaseapp.com",
  projectId: "opportunity-radar-e2f82",
  storageBucket: "opportunity-radar-e2f82.firebasestorage.app",
  messagingSenderId: "737725834586",
  appId: "1:737725834586:web:a3328ef782d200b6073f63"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const opportunities = [
  {
    id: "intern-1",
    title: "Frontend Development Internship",
    organization: "Internshala",
    category: "Internship",
    skills: ["html", "css", "javascript", "frontend", "web development"],
    deadline: "2026-11-15",
    url: "https://internshala.com/",
    description: "Build practical frontend development skills through project-based work."
  },
  {
    id: "hack-1",
    title: "Student Innovation Hackathon",
    organization: "Unstop",
    category: "Hackathon",
    skills: ["python", "ai", "web development", "javascript", "ui/ux", "design"],
    deadline: "2026-11-20",
    url: "https://unstop.com/",
    description: "Develop an innovative solution and demonstrate your problem-solving skills."
  },
  {
    id: "scholar-1",
    title: "Technology Student Scholarships",
    organization: "Buddy4Study",
    category: "Scholarship",
    skills: ["students", "technology", "education"],
    deadline: "2026-11-30",
    url: "https://www.buddy4study.com/",
    description: "Explore financial support opportunities for eligible students."
  },
  {
    id: "intern-2",
    title: "Web Development Learning Opportunity",
    organization: "freeCodeCamp",
    category: "Internship",
    skills: ["html", "css", "javascript", "web development"],
    deadline: "2026-12-15",
    url: "https://www.freecodecamp.org/",
    description: "Strengthen your portfolio with practical web development learning."
  },
  {
    id: "hack-2",
    title: "AI Project Challenge",
    organization: "Devpost",
    category: "Hackathon",
    skills: ["python", "ai", "machine learning", "web development"],
    deadline: "2026-12-10",
    url: "https://devpost.com/",
    description: "Explore project challenges and build solutions using technology."
  },
  {
    id: "scholar-2",
    title: "Student Funding Opportunities",
    organization: "National Scholarship Portal",
    category: "Scholarship",
    skills: ["students", "education", "technology"],
    deadline: "2026-12-20",
    url: "https://scholarships.gov.in/",
    description: "Check current scholarship schemes and their eligibility requirements."
  }
];

let currentUser = null;
let profile = {};
let savedIds = [];
let tracker = [];
let saving = Promise.resolve();
let accountLoaded = false;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(dateString) {
  if (!dateString) return "Not set";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isExpired(dateString) {
  if (!dateString) return false;
  return new Date(`${dateString}T23:59:59`).getTime() < Date.now();
}

function setLoginMessage(message) {
  $("#loginMessage").textContent = message;
}

function setProfileMessage(message) {
  $("#profileMessage").textContent = message;
}

function showLogin() {
  $("#app").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
}

function showApp() {
  $("#loginScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");

  const name = profile.name || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Student";

  $("#sidebarName").textContent = name;
  $("#sidebarAvatar").textContent = name.charAt(0).toUpperCase();

  renderOpportunities();
  renderTracker();
  fillProfile();
  updateStats();
}

async function saveCloud() {
  if (!currentUser || !accountLoaded) return;

  const uid = currentUser.uid;

  const data = {
    profile,
    savedIds,
    tracker,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  saving = saving
    .catch(() => {})
    .then(() => db.collection("users").doc(uid).set(data, { merge: true }));

  try {
    await saving;
  } catch (error) {
    console.error("Firestore save failed:", error);
    setProfileMessage("Could not sync data. Check your connection and Firestore rules.");
    throw error;
  }
}

async function loadUserData(user) {
  currentUser = user;
  accountLoaded = false;
  profile = {};
  savedIds = [];
  tracker = [];

  try {
    const doc = await db.collection("users").doc(user.uid).get();

    if (auth.currentUser?.uid !== user.uid) return;

    if (doc.exists) {
      const data = doc.data();

      profile = data.profile || {};
      savedIds = Array.isArray(data.savedIds) ? data.savedIds : [];
      tracker = Array.isArray(data.tracker) ? data.tracker : [];
    } else {
      profile = {
        name: user.displayName || user.email?.split("@")[0] || ""
      };
    }

    accountLoaded = true;
    showApp();
  } catch (error) {
    console.error("Firestore load failed:", error);
    currentUser = null;
    accountLoaded = false;
    await auth.signOut();
    showLogin();
    setLoginMessage("Unable to load your data. Check Firestore rules and try again.");
  }
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("#loginName").value.trim();
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  if (!name || !email || !password) return;

  const button = event.submitter;
  if (button) button.disabled = true;

  setLoginMessage("Signing in...");

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);

    if (!result.user.displayName && name) {
      await result.user.updateProfile({ displayName: name });
    }

    setLoginMessage("Signed in successfully.");
  } catch (error) {
    console.error("Sign-in failed:", error);
    setLoginMessage(getAuthError(error));
  } finally {
    if (button) button.disabled = false;
  }
});

$("#createAccountBtn").addEventListener("click", async () => {
  const name = $("#loginName").value.trim();
  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  if (!name || !email || !password) {
    setLoginMessage("Enter your name, email, and password first.");
    return;
  }

  if (password.length < 6) {
    setLoginMessage("Password must contain at least 6 characters.");
    return;
  }

  const button = $("#createAccountBtn");
  button.disabled = true;
  setLoginMessage("Creating your account...");

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });

    profile = { name };
    await db.collection("users").doc(result.user.uid).set({
      profile,
      savedIds: [],
      tracker: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setLoginMessage("Account created successfully.");
  } catch (error) {
    console.error("Account creation failed:", error);
    setLoginMessage(getAuthError(error));
  } finally {
    button.disabled = false;
  }
});

function getAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "This email already has an account. Use Sign in.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Account not found. Create an account first.",
    "auth/wrong-password": "Incorrect password.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };

  return messages[error.code] || `Authentication failed: ${error.message}`;
}

$("#signOutBtn").addEventListener("click", async () => {
  try {
    await auth.signOut();
    currentUser = null;
    accountLoaded = false;
    showLogin();
    $("#loginPassword").value = "";
    setLoginMessage("You have signed out.");
  } catch (error) {
    alert("Sign-out failed. Please try again.");
  }
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    await loadUserData(user);
  } else {
    currentUser = null;
    accountLoaded = false;
    showLogin();
  }
});

function renderOpportunities() {
  const query = $("#skillsInput").value.toLowerCase().trim();
  const category = $("#categoryFilter").value;

  const filtered = opportunities.filter((item) => {
    const categoryMatch = category === "All" || item.category === category;
    const text = [
      item.title,
      item.organization,
      item.category,
      item.description,
      ...item.skills
    ].join(" ").toLowerCase();

    const queryMatch = !query || query.split(/[,\s]+/)
      .filter(Boolean)
      .some((word) => text.includes(word));

    return categoryMatch && queryMatch;
  });

  const list = $("#opportunityList");

  if (!filtered.length) {
    list.innerHTML = '<p class="empty-state">No matching opportunities found. Try different skills or choose another category.</p>';
    return;
  }

  list.innerHTML = filtered.map((item) => {
    const saved = savedIds.includes(item.id);
    const expired = isExpired(item.deadline);

    return `
      <article class="opportunity-card">
        <div class="card-top">
          <span class="category-tag">${escapeHTML(item.category)}</span>
          <span class="small-note">${expired ? "Check next edition" : "Open listing"}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.organization)}</p>
        <p>${escapeHTML(item.description)}</p>
        <div class="opportunity-meta">Deadline: ${formatDate(item.deadline)}</div>
        <div class="card-actions">
          <button type="button" data-save="${item.id}">${saved ? "✓ Saved" : "+ Save opportunity"}</button>
          <button type="button" data-open="${item.id}">View website ↗</button>
          ${expired ? `<button type="button" data-rescue="${item.id}">Find alternatives</button>` : ""}
        </div>
      </article>`;
  }).join("");
}

$("#findBtn").addEventListener("click", renderOpportunities);
$("#skillsInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") renderOpportunities();
});
$("#categoryFilter").addEventListener("change", renderOpportunities);

$("#opportunityList").addEventListener("click", async (event) => {
  const saveButton = event.target.closest("[data-save]");
  const openButton = event.target.closest("[data-open]");
  const rescueButton = event.target.closest("[data-rescue]");

  if (saveButton) {
    const id = saveButton.dataset.save;
    const item = opportunities.find((opportunity) => opportunity.id === id);
    if (!item) return;

    if (savedIds.includes(id)) {
      savedIds = savedIds.filter((savedId) => savedId !== id);
      tracker = tracker.filter((entry) => entry.id !== id);
    } else {
      savedIds.push(id);
      if (!tracker.some((entry) => entry.id === id)) {
        tracker.push({
          id,
          title: item.title,
          organization: item.organization,
          deadline: item.deadline,
          status: "Interested"
        });
      }
    }

    renderOpportunities();
    renderTracker();
    updateStats();
    await saveCloud().catch(() => {});
  }

  if (openButton) {
    const item = opportunities.find((opportunity) => opportunity.id === openButton.dataset.open);
    if (item) window.open(item.url, "_blank", "noopener,noreferrer");
  }

  if (rescueButton) {
    const item = opportunities.find((opportunity) => opportunity.id === rescueButton.dataset.rescue);
    if (item) {
      $("#missedOpportunity").value = item.title;
      showRescueResults(item.title);
      $("#rescue").scrollIntoView({ behavior: "smooth" });
    }
  }
});

function renderTracker() {
  const list = $("#trackerList");
  tracker = tracker.filter((item) => savedIds.includes(item.id));

  if (!tracker.length) {
    list.innerHTML = '<p class="empty-state">No saved opportunities yet. Go to Opportunity Radar and select “Save opportunity”.</p>';
    return;
  }

  list.innerHTML = tracker.map((item) => `
    <article class="tracker-item">
      <div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.organization)} · Deadline: ${formatDate(item.deadline)}</p>
      </div>
      <select data-status="${item.id}" aria-label="Application status">
        ${["Interested", "Preparing", "Applied", "Shortlisted", "Rejected"].map((status) =>
          `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`
        ).join("")}
      </select>
      <input type="date" data-deadline="${item.id}" value="${escapeHTML(item.deadline || "")}" aria-label="Deadline">
      <button class="remove-btn" type="button" data-remove="${item.id}">Remove</button>
    </article>
  `).join("");
}

$("#trackerList").addEventListener("change", async (event) => {
  const statusId = event.target.dataset.status;
  const deadlineId = event.target.dataset.deadline;

  if (statusId) {
    const item = tracker.find((entry) => entry.id === statusId);
    if (item) item.status = event.target.value;
  }

  if (deadlineId) {
    const item = tracker.find((entry) => entry.id === deadlineId);
    if (item) item.deadline = event.target.value;
  }

  renderTracker();
  updateStats();
  await saveCloud().catch(() => {});
});

$("#trackerList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  const id = button.dataset.remove;
  tracker = tracker.filter((item) => item.id !== id);
  savedIds = savedIds.filter((savedId) => savedId !== id);

  renderTracker();
  renderOpportunities();
  updateStats();
  await saveCloud().catch(() => {});
});

function updateStats() {
  $("#availableCount").textContent = opportunities.length;
  $("#savedCount").textContent = savedIds.length;
  $("#appliedCount").textContent = tracker.filter((item) => item.status === "Applied").length;
}

function fillProfile() {
  const fields = {
    profileName: "name",
    college: "college",
    school: "school",
    resume: "resume",
    profileSkills: "skills",
    achievements: "achievements",
    projects: "projects",
    careerGoals: "careerGoals"
  };

  Object.entries(fields).forEach(([elementId, key]) => {
    $(`#${elementId}`).value = profile[key] || "";
  });
}

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  profile = {
    name: $("#profileName").value.trim(),
    college: $("#college").value.trim(),
    school: $("#school").value.trim(),
    resume: $("#resume").value.trim(),
    skills: $("#profileSkills").value.trim(),
    achievements: $("#achievements").value.trim(),
    projects: $("#projects").value.trim(),
    careerGoals: $("#careerGoals").value.trim()
  };

  if (currentUser && profile.name && profile.name !== currentUser.displayName) {
    await currentUser.updateProfile({ displayName: profile.name }).catch(() => {});
  }

  $("#sidebarName").textContent = profile.name || "Student";
  $("#sidebarAvatar").textContent = (profile.name || "S").charAt(0).toUpperCase();

  try {
    await saveCloud();
    setProfileMessage("Profile saved to your account!");
  } catch {
    setProfileMessage("Save failed. Please check your connection and rules.");
  }
});

$("#rescueForm").addEventListener("submit", (event) => {
  event.preventDefault();
  showRescueResults($("#missedOpportunity").value.trim());
});

function showRescueResults(name) {
  const normalized = name.toLowerCase();

  const similar = opportunities.filter((item) => {
    if (item.title.toLowerCase() === normalized) return false;
    if (isExpired(item.deadline)) return false;
    return true;
  }).slice(0, 3);

  $("#rescueResults").innerHTML = `
    <article class="rescue-tip">
      <strong>1. Check the next edition</strong>
      <p>Visit the organizer's official website to see whether another edition or application cycle is available.</p>
    </article>
    <article class="rescue-tip">
      <strong>2. Prepare for the next deadline</strong>
      <p>Update your resume, portfolio, and project links so your next application is ready.</p>
    </article>
    <article class="rescue-tip">
      <strong>3. Explore other opportunities</strong>
      <p>These are sample alternatives to investigate. Verify current eligibility and deadlines before applying.</p>
    </article>
    ${similar.map((item) => `
      <article class="rescue-tip">
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.organization)} · Deadline: ${formatDate(item.deadline)}</p>
        <p>${escapeHTML(item.description)}</p>
        <div class="card-actions">
          <button type="button" data-rescue-save="${item.id}">Save alternative</button>
          <button type="button" data-rescue-open="${item.id}">View website ↗</button>
        </div>
      </article>
    `).join("")}
  `;
}

$("#rescueResults").addEventListener("click", async (event) => {
  const saveButton = event.target.closest("[data-rescue-save]");
  const openButton = event.target.closest("[data-rescue-open]");

  if (saveButton) {
    const id = saveButton.dataset.rescueSave;
    const item = opportunities.find((opportunity) => opportunity.id === id);

    if (item && !savedIds.includes(id)) {
      savedIds.push(id);
      tracker.push({
        id,
        title: item.title,
        organization: item.organization,
        deadline: item.deadline,
        status: "Interested"
      });

      renderTracker();
      renderOpportunities();
      updateStats();
      await saveCloud().catch(() => {});
      saveButton.textContent = "✓ Saved";
    } else if (item) {
      saveButton.textContent = "Already saved";
    }
  }

  if (openButton) {
    const item = opportunities.find((opportunity) => opportunity.id === openButton.dataset.rescueOpen);
    if (item) window.open(item.url, "_blank", "noopener,noreferrer");
  }
});

function addChatMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `chat-message ${sender === "user" ? "user-message" : "bot-message"}`;
  message.textContent = text;
  $("#chatMessages").appendChild(message);
  $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
}

function getChatResponse(message) {
  const text = message.toLowerCase();

  if (text.includes("resume") || text.includes("cv")) {
    return "Improve your resume by highlighting relevant skills, projects, certifications, and achievements. Keep the layout clear and include working portfolio or GitHub links.";
  }

  if (text.includes("skill") || text.includes("learn")) {
    return "For frontend development, focus on HTML, CSS, JavaScript, Git, responsive design, and practical projects you can demonstrate.";
  }

  if (text.includes("miss") || text.includes("deadline") || text.includes("expired")) {
    return "Don't give up! Check the organizer's official page for a new edition, explore similar open opportunities, and prepare your application materials.";
  }

  if (text.includes("project")) {
    return "Choose a real problem, build a working solution, document how it works, and publish the code or demo. Explain your contribution clearly.";
  }

  if (text.includes("internship") || text.includes("apply") || text.includes("application")) {
    return "Before applying, check eligibility, deadline, required skills, and fees. Customize your resume and apply through verified official links.";
  }

  if (text.includes("hackathon")) {
    return "Prepare a clear problem statement, a working prototype, a short demo, and an explanation of the impact. Check the official rules and submission requirements.";
  }

  if (text.includes("hello") || text.startsWith("hi")) {
    return "Hi! Ask me about resumes, skills, projects, internships, hackathons, or missed deadlines.";
  }

  return "I can help with resumes, skill development, projects, internship applications, hackathons, and missed-deadline planning.";
}

$("#chatForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const input = $("#chatInput");
  const message = input.value.trim();

  if (!message) return;

  addChatMessage(message, "user");
  input.value = "";
  addChatMessage(getChatResponse(message), "bot");
});

document.querySelectorAll(".sidebar nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("#pageTitle").textContent = link.textContent.trim().replace(/^[^\w]+/, "");
  });
});
