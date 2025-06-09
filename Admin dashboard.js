// src/components/AdminDashboard.js (or wherever your component lives)

import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase"; // <-- IMPORTANT: Adjust path if firebase.js is elsewhere
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  updateDoc,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { CSVLink } from "react-csv";
import moment from "moment";
import { debounce } from "lodash";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Import Cloud Functions SDK (if you're using the banUser cloud function)
import { getFunctions, httpsCallable } from 'firebase/functions';

// IMPORTANT: This env variable should be set in your .env file
const ADMIN_UIDS = process.env.REACT_APP_ADMIN_UIDS?.split(",") || [];

function AdminDashboard() {
  const [moments, setMoments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalMomentsCount, setTotalMomentsCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isBanning, setIsBanning] = useState(null);

  // Chat specific state hooks
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null); // the user object
  const [chatId, setChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");


  const itemsPerPage = 10;
  const navigate = useNavigate();

  // Initialize Firebase Functions client (if you're using the banUser cloud function)
  const functions = getFunctions();
  const banUserFunction = httpsCallable(functions, 'banUser');

  // Refs for unsubscribe functions and debounce
  const momentsUnsubRef = useRef(null);
  const usersUnsubRef = useRef(null);
  const debouncedSearch = useRef(
    debounce((value) => {
      setSearchTerm(value);
      setCurrentPage(1);
      setLastVisible(null);
    }, 300)
  ).current;

  // 1. Authentication and real-time users subscription
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !ADMIN_UIDS.includes(user.uid)) {
        toast.error("Access denied. Admins only.", { autoClose: 3000 });
        navigate("/");
        setLoading(false);
        if (momentsUnsubRef.current) momentsUnsubRef.current();
        if (usersUnsubRef.current) usersUnsubRef.current();
        return;
      }

      usersUnsubRef.current = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          setUsers(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
        },
        (error) => {
          console.error("Error fetching users:", error);
          toast.error("Failed to fetch users.", { autoClose: 3000 });
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (momentsUnsubRef.current) momentsUnsubRef.current();
      if (usersUnsubRef.current) usersUnsubRef.current();
    };
  }, [navigate]);

  // 2. Efficient total moments count (aggregation query)
  const fetchTotalMomentsCount = async () => {
    try {
      const q = query(collection(db, "moments"));
      const snapshot = await getCountFromServer(q);
      setTotalMomentsCount(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching total moments count:", error);
      toast.error("Failed to fetch total moments count.", { autoClose: 3000 });
    }
  };

  // 3. Real-time moments with pagination & search
  const loadMoments = () => {
    setLoading(true);
    if (momentsUnsubRef.current) momentsUnsubRef.current();

    let baseQuery = collection(db, "moments");
    let q;

    if (searchTerm) {
      q = query(
        baseQuery,
        orderBy("caption"),
        where("caption", ">=", searchTerm),
        where("caption", "<=", searchTerm + "\uf8ff"),
        ...(lastVisible && currentPage > 1 ? [startAfter(lastVisible)] : []),
        limit(itemsPerPage)
      );
    } else {
      q = query(
        baseQuery,
        orderBy("timestamp", "desc"),
        ...(lastVisible && currentPage > 1 ? [startAfter(lastVisible)] : []),
        limit(itemsPerPage)
      );
    }

    momentsUnsubRef.current = onSnapshot(
      q,
      (snapshot) => {
        const newMoments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
        }));

        setMoments(newMoments);
        setHasMore(newMoments.length === itemsPerPage);

        if (snapshot.docs.length > 0) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        } else {
          setLastVisible(null);
        }

        setLoading(false);
      },
      (error) => {
        console.error("Error fetching moments:", error);
        toast.error("Failed to fetch moments.", { autoClose: 3000 });
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    loadMoments();
    fetchTotalMomentsCount();
    return () => {
      if (momentsUnsubRef.current) momentsUnsubRef.current();
    };
    // eslint-disable-next-line
  }, [currentPage, searchTerm]);

  // 4. Delete Moment
  const handleDeleteMoment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this moment?")) return;
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, "moments", id));
      toast.success("Moment deleted successfully!", { autoClose: 2000 });
      fetchTotalMomentsCount();
    } catch (err) {
      console.error("Error deleting moment:", err);
      toast.error("Failed to delete moment.", { autoClose: 3000 });
    } finally {
      setIsDeleting(null);
    }
  };

  // 5. Ban User (calls Cloud Function)
  const handleBanUser = async (userId) => {
    if (!window.confirm("Are you sure you want to ban this user? This will also revoke their active sessions.")) return;
    setIsBanning(userId);
    try {
      const result = await banUserFunction({ userId });

      if (result.data.success) {
        toast.success(result.data.message, { autoClose: 3000 });
      } else {
        toast.error(result.data.message || "Failed to ban user via Cloud Function.", { autoClose: 3000 });
      }
    } catch (err) {
      console.error("Error calling banUser Cloud Function:", err);
      toast.error(`Error banning user: ${err.message || 'Unknown error.'}`, { autoClose: 5000 });
    } finally {
      setIsBanning(null);
    }
  };

  // 6. CSV Data
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

  // Chat Functions
  const getOrCreateChat = async (userAId, userBId) => {
    // Ensure consistent order for chat members to find existing chat
    const members = [userAId, userBId].sort();
    const chatQuery = query(
      collection(db, "chats"),
      where("members", "==", members)
    );
    const snap = await getDocs(chatQuery);

    if (!snap.empty) {
      return snap.docs[0].id;
    }
    // Create new chat
    const docRef = await addDoc(collection(db, "chats"), {
      members,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  };

  const openChatWithUser = async (user) => {
    if (!auth.currentUser) {
      toast.error("You must be logged in to chat.", { autoClose: 3000 });
      return;
    }
    const cId = await getOrCreateChat(auth.currentUser.uid, user.id);
    setChatId(cId);
    setChatTarget(user);
    setChatOpen(true);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (chatInput.trim() === "" || !chatId || !auth.currentUser) return;

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: chatInput,
        senderId: auth.currentUser.uid,
        senderEmail: auth.currentUser.email, // Or displayName
        createdAt: serverTimestamp(),
      });
      setChatInput("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.", { autoClose: 3000 });
    }
  };

  // Real-time chat messages listener
  useEffect(() => {
    if (!chatOpen || !chatId) return;

    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(messagesQuery, (snap) => {
      setChatMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to chat messages:", error);
      toast.error("Failed to load chat messages.", { autoClose: 3000 });
    });

    return unsub; // Cleanup listener on unmount or dependency change
  }, [chatOpen, chatId]);


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
            {moments.map((moment) => (
              <div
                key={moment.id}
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <p className="text-gray-800 dark:text-gray-200 font-semibold">
                      {moment.caption || "No caption"}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <p>
                        Posted by:{" "}
                        {users.find((u) => u.id === moment.userId)?.email ||
                          "Unknown"}{" "}
                        |
                        {moment.timestamp && (
                          <> {moment(moment.timestamp).format("MMM D,YYYY h:mm A")}</>
                        )}
                      </p>
                      <p className="mt-1">
                        Likes: {moment.likes?.length || 0} | Comments:{" "}
                        {moment.comments?.length || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/moment/${moment.id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
                      aria-label={`View moment ${moment.caption || moment.id}`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteMoment(moment.id)}
                      className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isDeleting === moment.id}
                      aria-label={`Delete moment ${moment.caption || moment.id}`}
                    >
                      {isDeleting === moment.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                {moment.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={moment.imageUrl}
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
            disabled
