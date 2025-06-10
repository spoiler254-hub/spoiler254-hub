// In your AdminDashboard.js
const API_URL = "http://localhost:5000/api";

// Replace your Firebase calls with API calls:

// Fetch users
const fetchUsers = async () => {
  try {
    const response = await fetch(`${API_URL}/users`);
    const data = await response.json();
    setUsers(data);
  } catch (err) {
    console.error("Error fetching users:", err);
    alert("Failed to fetch users.");
  }
};

// Fetch moments
const fetchMoments = async () => {
  setLoading(true);
  try {
    const response = await fetch(`${API_URL}/moments`);
    const data = await response.json();
    setMoments(data);
  } catch (err) {
    console.error("Error fetching moments:", err);
    alert("Failed to fetch moments.");
  } finally {
    setLoading(false);
  }
};

// Delete moment
const handleDeleteMoment = async (id) => {
  if (window.confirm("Are you sure you want to delete this moment?")) {
    try {
      await fetch(`${API_URL}/delete-moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id })
      });
      setMoments(moments.filter(moment => moment.id !== id));
    } catch (err) {
      console.error("Error deleting moment:", err);
      alert("Failed to delete moment.");
    }
  }
};
