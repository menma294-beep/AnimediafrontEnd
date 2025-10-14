
    const frontendHost = window.location.hostname;
    const backendPort = 8000;
    const API_BASE_URL = `http://${frontendHost}:${backendPort}`;
    const token = localStorage.getItem("token");
  
    if (!token) {
      alert("You must log in first!");
      window.location.href = "index.html";
    }
  
    // Robust JWT parser (handles base64url)
    function parseJwt(t) {
      try {
        const base64Url = t.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    }
  
    function getCurrentUserId() {
      const payload = parseJwt(token);
      // Common claim names to check
      return payload?.sub || payload?.user_id || payload?.id || null;
    }
  







    async function fetchJson(url, opts = {}) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.warn("fetchJson error:", e);
        return null;
      }
    }
    
    // ---- helper: normalize the react summary returned by backend ----
    async function fetchReactSummary(postId) {
      // endpoint may return either an object like { post_id, reacts, has_liked, like_count }
      // or (older) simply an array of reacts. This helper normalizes both shapes.
      const summary = await fetchJson(`${API_BASE_URL}/reacts/post/${postId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!summary) return { reacts: [], like_count: 0, has_liked: false };
    
      if (Array.isArray(summary)) {
        // older shape: array of react objects
        return { reacts: summary, like_count: summary.length, has_liked: false };
      }
    
      // assume object with fields; defensive defaults:
      return {
        reacts: Array.isArray(summary.reacts) ? summary.reacts : [],
        like_count: typeof summary.like_count === "number" ? summary.like_count : (Array.isArray(summary.reacts) ? summary.reacts.length : 0),
        has_liked: !!summary.has_liked
      };
    }














    // helper to fetch and normalize JSON result to array
    async function fetchJsonArray(url, opts = {}) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data == null) return [];
        // if server returned a single object, wrap it in array
        if (typeof data === 'object') return [data];
        return [];
      } catch (e) {
        console.warn("fetchJsonArray error:", e);
        return [];
      }
    }
  
    async function addComment() {
      const content = document.getElementById("newComment").value.trim();
      if (!content || !currentPostId) return;
      try {
        const response = await fetch(`${API_BASE_URL}/comments/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ post_id: currentPostId, content })
        });
        if (!response.ok) throw new Error("Failed to add comment");
        document.getElementById("newComment").value = "";
        commentPost(currentPostId);
      } catch (err) {
        console.error(err);
        alert("Error adding comment: " + err.message);
      }
    }
  
    async function createPost() {
      const content = document.getElementById("postContent").value.trim();
      if (!content) {
        alert("Post content cannot be empty!");
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/posts/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error("Failed to create post");
        fetchPosts();
        document.getElementById("postContent").value = "";
      } catch (err) {
        console.error(err);
        alert("Error creating post: " + err.message);
      }
    }
  
    async function fetchPosts() {
      const feed = document.getElementById('feed');
      feed.innerHTML = '';
      try {
        const response = await fetch(`${API_BASE_URL}/posts`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const posts = await response.json();
        if (!Array.isArray(posts) || posts.length === 0) {
          feed.innerHTML = "<p>No posts yet!</p>";
          return;
        }
    
        const currentUser = getCurrentUserId(); // should return user id string or null
    
        for (const post of posts) {
          // parse created_at (your existing logic)
          const dateObj = post.created_at;
          const year = dateObj._DateTime__date._Date__year;
          const month = dateObj._DateTime__date._Date__month - 1;
          const day = dateObj._DateTime__date._Date__day;
          const hour = dateObj._DateTime__time._Time__hour;
          const minute = dateObj._DateTime__time._Time__minute;
          const second = dateObj._DateTime__time._Time__second;
          const createdAt = new Date(year, month, day, hour, minute, second);
    
          // fetch react summary
          const summary = await fetchReactSummary(post.id);
          // If backend provides has_liked, prefer it; otherwise check reacts array for current user id
          const reactsCount = summary.like_count ?? (summary.reacts ? summary.reacts.length : 0);
          const userReacted = (typeof summary.has_liked === 'boolean')
            ? summary.has_liked
            : (currentUser ? summary.reacts.some(r => r.user_id === currentUser) : false);
    
          const postElement = document.createElement('div');
          postElement.classList.add('post');
          postElement.innerHTML = `
            <div class="post-header">
              <div class="profile-pic"></div>
              <div>
                <div class="post-author">${post.author_username}</div>
                <div class="post-date">${createdAt.toLocaleString()}</div>
              </div>
            </div>
            <div class="post-content">${post.content}</div>
            <div class="actions">
              <button id="like-btn-${post.id}" style="color:${userReacted ? 'red' : 'black'}">
                ${userReacted ? 'Liked' : 'Like'}
              </button>
              <button class="react-count-btn" onclick="openReactors('${post.id}')">
                👍 <span id="react-count-${post.id}">${reactsCount}</span>
              </button>
              <button onclick="commentPost('${post.id}')">Comment</button>
            </div>
          `;
          feed.appendChild(postElement);
    
          // attach like toggle handler
          const likeBtn = document.getElementById(`like-btn-${post.id}`);
          likeBtn.addEventListener('click', () => toggleLike(post.id, likeBtn));
        }
      } catch (err) {
        console.error(err);
        alert("Failed to fetch posts: " + err.message);
      }
    }
    
    
    // Toggle like/unlike
    // ---- toggle like/unlike ----
async function toggleLike(postId, btn) {
  try {
    const currentUser = getCurrentUserId();
    if (!currentUser) { 
      alert("Can't determine current user"); 
      return; 
    }

    const summary = await fetchReactSummary(postId);
    const userReacted = summary.has_liked === true;
    const countEl = document.getElementById(`react-count-${postId}`);
    let currentCount = parseInt(countEl?.textContent || "0", 10);

    if (userReacted) {
      // user already liked → send unlike
      const res = await fetch(`${API_BASE_URL}/reacts/unlike`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ target_id: postId, react_type: "like" }) // ✅ add react_type
      });
    
      if (!res.ok) throw new Error("Failed to unlike");
      btn.innerText = "Like";
      btn.style.color = "black";
      countEl.textContent = Math.max(0, currentCount - 1);
    }
    else {
      // user not liked yet → send like
      const res = await fetch(`${API_BASE_URL}/reacts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ target_id: postId, react_type: "like" })
      });

      if (!res.ok) throw new Error("Failed to like");
      btn.innerText = "Liked";
      btn.style.color = "red";
      countEl.textContent = currentCount + 1;
    }

  } catch (err) {
    console.error(err);
    alert("Error toggling like: " + err.message);
  }
}

  
    // Comment functions unchanged...
    let currentPostId = null;
  
    async function commentPost(postId) {
      currentPostId = postId;
      const commentList = document.getElementById("commentList");
      commentList.innerHTML = "";
  
      try {
        const response = await fetch(`${API_BASE_URL}/comments/post/${postId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("Failed to fetch comments");
        const comments = await response.json();
  
        if (comments.length === 0) {
          commentList.innerHTML = "<p>No comments yet!</p>";
        } else {
          comments.forEach(c => {
            const div = document.createElement("div");
            div.classList.add("comment");
            div.innerHTML = `
              <div class="profile-pic"></div>
              <div>
                <div class="comment-author">${c.author_username}</div>
                <div class="comment-text">${c.content}</div>
              </div>
            `;
            commentList.appendChild(div);
          });
        }
  
        document.getElementById("commentModal").style.display = "flex";
      } catch (err) {
        console.error(err);
        alert("Error loading comments: " + err.message);
      }
    }
  
    function closeModal() {
      const modal = document.getElementById("commentModal");
      modal.style.display = "none";
      document.getElementById("commentList").innerHTML = "";
      document.getElementById("newComment").value = "";
    }
  
    // Reactors modal (unchanged)
    // ---- openReactors: show modal with list of users who reacted ----
async function openReactors(postId) {
  try {
    const summary = await fetchReactSummary(postId);
    const users = summary.reacts || [];

    const modal = document.createElement("div");
    modal.classList.add("modal");
    modal.style.display = "flex";
    modal.innerHTML = `
      <div class="modal-content" style="width:350px;height:400px;overflow-y:auto;position:relative;">
        <div class="modal-header">
          Reacted Users
          <span class="close" style="cursor:pointer;font-weight:bold;" onclick="this.closest('.modal').remove()">&times;</span>
        </div>
        <div id="reactorList" style="padding:10px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    const reactorList = modal.querySelector("#reactorList");

    if (!Array.isArray(users) || users.length === 0) {
      reactorList.innerHTML = "<p>No reactions yet!</p>";
    } else {
      users.forEach(u => {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.gap = "10px";
        div.style.marginBottom = "10px";
        div.innerHTML = `
          <div style="width:30px;height:30px;border-radius:50%;background:gray;"></div>
          <span>${u.user_username}</span>
        `;
        reactorList.appendChild(div);
      });
    }
  } catch (err) {
    console.error(err);
    alert("Failed to load reactors: " + err.message);
  }
}
  
    // initial load
    fetchPosts();

  