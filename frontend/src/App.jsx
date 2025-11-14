// import { useEffect } from "react";
// import {
//   BrowserRouter,
//   Routes,
//   Route,
//   Navigate,
// } from "react-router-dom";
// import {
//   SignedIn,
//   SignedOut,
//   SignIn,
//   SignUp,
//   useUser,
//   useAuth,
// } from "@clerk/clerk-react";
// import axios from "axios";

// import Dashboard from "./components/Dashboard";
// import AuthPage from "./components/AuthPage";
// import Navbar from "./components/Navbar"; 
// import ResumeUpload from "./components/ResumeUpload";
// import JobDescription from "./components/JobDescription"; 
// import CustomizeResume from "./components/CustomizeResume";
// import Payment from "./components/Payment"; // ✅ NEW: Import Payment component
// import Footer from "./components/Footer";

// const API_URL = import.meta.env.VITE_API_URL;

// function App() {
//   const { user } = useUser();
//   const { getToken } = useAuth();

//   // ✅ Sync user with backend only once when logged in
//   useEffect(() => {
//     const syncUser = async () => {
//       if (!user) return;
//       try {
//         const token = await getToken();
//         if (!token) return console.error("No token found");

//         await axios.post(
//           `${API_URL}/user/sync`,
//           {},
//           { headers: { Authorization: `Bearer ${token}` } }
//         );
//         console.log("✅ User synced successfully");
//       } catch (err) {
//         console.error("❌ User sync failed:", err.message);
//         if (err.response) console.error("Backend Response:", err.response.data);
//       }
//     };
//     syncUser();
//   }, [user, getToken]);

//   return (
//     <BrowserRouter>
//       {/* ✅ Navbar visible on all signed-in pages */}
//       <SignedIn>
//         <Navbar />
//       </SignedIn>

//       <Routes>
//         {/* Default route */}
//         <Route
//           path="/"
//           element={
//             <>
//               <SignedIn>
//                 <Dashboard />
//               </SignedIn>
//               <SignedOut>
//                 <AuthPage />
//               </SignedOut>
//             </>
//           }
//         />

//         {/* ✅ Resume Upload Page */}
//         <Route
//           path="/upload"
//           element={
//             <SignedIn>
//               <ResumeUpload />
//             </SignedIn>
//           }
//         />

//         {/* ✅ Job Description Page */}
//         <Route
//           path="/description"
//           element={
//             <SignedIn>
//               <JobDescription />
//             </SignedIn>
//           }
//         />

//         {/* ✅ Customize Resume Page */}
//         <Route
//           path="/customize-resume"
//           element={
//             <SignedIn>
//               <CustomizeResume />
//             </SignedIn>
//           }
//         />

//         {/* ✅ Payment Page - NEW */}
//         <Route
//           path="/payment"
//           element={
//             <SignedIn>
//               <Payment />
//             </SignedIn>
//           }
//         />

//         {/* Clerk Auth Routes */}
//         <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
//         <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" />} />

//         {/* Fallback redirect */}
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
      
//       <SignedIn>
//         <Footer />
//       </SignedIn>
//     </BrowserRouter>
//   );
// }

// export default App;





import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  useUser,
  useAuth,
} from "@clerk/clerk-react";
import axios from "axios";

import Dashboard from "./components/Dashboard";
import AuthPage from "./components/AuthPage";
import Navbar from "./components/Navbar"; 
import ResumeUpload from "./components/ResumeUpload";
import JobDescription from "./components/JobDescription"; 
import CustomizeResume from "./components/CustomizeResume";
import Payment from "./components/Payment";
import Footer from "./components/Footer";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const { user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    const syncUser = async () => {
      if (!user) return;
      try {
        const token = await getToken();
        if (!token) return console.error("No token found");

        await axios.post(
          `${API_URL}/user/sync`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("✅ User synced successfully");
      } catch (err) {
        console.error("❌ User sync failed:", err.message);
        if (err.response) console.error("Backend Response:", err.response.data);
      }
    };
    syncUser();
  }, [user, getToken]);

  return (
    <BrowserRouter>
      <SignedIn>
        <Navbar />
      </SignedIn>

      <Routes>
        {/* Default route */}
        <Route
          path="/"
          element={
            <>
              <SignedIn>
                <Dashboard />
              </SignedIn>
              <SignedOut>
                <AuthPage />
              </SignedOut>
            </>
          }
        />

        {/* Resume Upload Page */}
        <Route
          path="/upload"
          element={
            <SignedIn>
              <ResumeUpload />
            </SignedIn>
          }
        />

        {/* Job Description Page */}
        <Route
          path="/description"
          element={
            <SignedIn>
              <JobDescription />
            </SignedIn>
          }
        />

        {/* Customize Resume Page */}
        <Route
          path="/customize-resume"
          element={
            <SignedIn>
              <CustomizeResume />
            </SignedIn>
          }
        />

        {/* Payment Page */}
        <Route
          path="/payment"
          element={
            <SignedIn>
              <Payment />
            </SignedIn>
          }
        />

        {/* Fallback: redirect everything to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <SignedIn>
        <Footer />
      </SignedIn>
    </BrowserRouter>
  );
}

export default App;