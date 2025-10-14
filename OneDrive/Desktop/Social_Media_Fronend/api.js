// Detect backend URL automatically (use your PC IP + FastAPI port)
const backendUrl = `http://${window.location.hostname}:8000`;

// Helper for authenticated requests
async function apiRequest(endpoint, method = "GET", body = null) {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };

    if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${backendUrl}${endpoint}`, options);

    if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
    }

    return response.json();
}
