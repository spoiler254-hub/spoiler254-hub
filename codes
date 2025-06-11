import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CSVLink } from "react-csv";
import moment from "moment";
import { debounce } from "lodash";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ADMIN_UIDS = process.env.REACT_APP_ADMIN_UIDS?.split(",") || [];

function AdminDashboard() {
  const [moments, setMoments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalMomentsCount, setTotalMomentsCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(null);

  const itemsPerPage = 10;
  const navigate = useNavigate();

  // Debounced search
  const debouncedSearch = useRef(
    debounce((value) => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300)
  ).current;

  // Fetch users from Flask API
  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to fetch users.", { autoClose: 3000 });
    }
  };

  // Fetch moments from Flask API
  const fetchMoments = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/moments");
      let data = await res.json();
      // Simple search and pagination on client side
      if (searchTerm) {
        data = data.filter(m =>
          (m.caption || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setTotalMomentsCount(data.length);
      const start = (currentPage - 1) * itemsPerPage;
      const paged = data.slice(start, start + itemsPerPage);
      setMoments(paged);
      setHasMore(start + itemsPerPage < data.length);
    } catch (error) {
      toast.error("Failed to fetch moments.", { autoClose: 3000 });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchMoments();
  }, [currentPage, searchTerm]);

  // Delete moment via Flask API
  const handleDeleteMoment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this moment?")) return;
    setIsDeleting(id);
    try {
      const res = await fetch("http://localhost:5000/api/delete-moment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Moment deleted successfully!", { autoClose: 2000 });
        fetchMoments();
      } else {
        toast.error(data.error || "Failed to delete moment.", { autoClose: 3000 });
      }
    } catch (err) {
      toast.error("Failed to delete moment.", { autoClose: 3000 });
    } finally {
      setIsDeleting(null);
    }
  };

  // CSV Data
  const getCSVData = () => {
    return moments.map((moment) => ({
      ID: moment.id,
      Caption: moment.caption || "No caption",
      User: users.find((u) => u.id === moment.userId)?.email || moment.userId,
      Created: moment.timestamp
        ? moment(moment.timestamp).format("YYYY-MM-DD HH:mm:ss")
        : "N/A",
      Likes: moment.likes?.length || 0,
      Comments: moment.comments?.length || 0,
      ImageURL: moment.imageUrl || "None",
    }));
  };

  if (loading && currentPage === 1) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  // --- UI ---
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={5000} />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <CSVLink
          data={getCSVData()}
          filename={`moments-export-${moment().format("YYYY-MM-DD")}.csv`}
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
          aria-label="Export moments data to CSV"
        >
          Export to CSV
        </CSVLink>
      </div>

      {/* Users Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">User Accounts ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-4 text-center">
                No user accounts found.
              </p>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-left py-2 px-2">Joined</th>
                    <th className="text-left py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <td className="py-2 px-2">
                        {user.displayName || "Unnamed User"}
                      </td>
                      <td className="py-2 px-2">{user.email}</td>
                      <td className="py-2 px-2">
                        {user.metadata?.creationTime
                          ? moment(user.metadata.creationTime).format("MMM D,YYYY")
                          : "Unknown"}
                      </td>
                      <td className="py-2 px-2 flex gap-2 items-center">
                        {ADMIN_UIDS.includes(user.id) ? (
                          <span className="text-gray-500 dark:text-gray-400 text-xs py-1 px-2 rounded">
                            Admin
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleBanUser(user.id)}
                              className="bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={isBanning === user.id}
                              aria-label={`Ban user ${user.displayName || user.email}`}
                            >
                              {isBanning === user.id ? "Banning..." : "Ban"}
                            </button>
                            {/* Chat Button */}
                            <button
                              onClick={() => openChatWithUser(user)}
                              className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs ml-2"
                              aria-label={`Chat with ${user.displayName || user.email}`}
                              disabled={auth.currentUser?.uid === user.id} // Disable if admin is trying to chat with themselves
                            >
                              Chat
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Users</p>
              <p className="text-xl font-bold">{users.length}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Moments</p>
              <p className="text-xl font-bold">{totalMomentsCount}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Active Today</p>
              <p className="text-xl font-bold">
                {
                  users.filter(
                    (u) =>
                      u.metadata?.lastSignInTime &&
                      moment(u.metadata.lastSignInTime).isAfter(
                        moment().startOf("day")
                      )
                  ).length
                }
              </p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
              <p className="text-gray-600 dark:text-gray-400 text-sm">New This Week</p>
              <p className="text-xl font-bold">
                {
                  users.filter(
                    (u) =>
                      u.metadata?.creationTime &&
                      moment(u.metadata.creationTime).isAfter(
                        moment().startOf("week")
                      )
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Moments Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-xl font-semibold">User Moments</h3>
          <div className="w-full md:w-auto">
            <input
              type="text"
              placeholder="Search moments by caption..."
              onChange={(e) => debouncedSearch(e.target.value)}
              className="w-full md:w-64 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search moments"
            />
          </div>
        </div>

        {moments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-4 text-center">
            {searchTerm ? "No moments match your search" : "No moments found"}
          </p>
        ) : (
          <div className="space-y-4">
            {moments.map((m) => (
              <div
                key={m.id}
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <p className="text-gray-800 dark:text-gray-200 font-semibold">
                      {m.caption || "No caption"}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <p>
                        Posted by:{" "}
                        {users.find((u) => u.id === m.userId)?.email || "Unknown"}{" "}
                        |
                        {m.timestamp && (
                          <> {moment(m.timestamp).format("MMM D,YYYY h:mm A")}</>
                        )}
                      </p>
                      <p className="mt-1">
                        Likes: {m.likes?.length || 0} | Comments:{" "}
                        {m.comments?.length || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/moment/${m.id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
                      aria-label={`View moment ${m.caption || m.id}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteMoment(m.id)}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isDeleting === m.id}
                      aria-label={`Delete moment ${m.caption || m.id}`}
                    >
                      {isDeleting === m.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                {m.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={m.imageUrl}
                      alt="Moment"
                      className="max-h-60 rounded object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`py-2 px-4 rounded ${
              currentPage === 1
                ? "bg-gray-200 dark:bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-gray-700 dark:text-gray-300">
            Page {currentPage}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!hasMore}
            className={`py-2 px-4 rounded ${
              !hasMore
                ? "bg-gray-200 dark:bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
