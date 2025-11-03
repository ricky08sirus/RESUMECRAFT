import { useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function LoginRedirect() {
  const { user } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    const syncUser = async () => {
      if (user) {
        const token = await clerk.session?.getToken();
        await fetch("/user/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        navigate("/dashboard");
      }
    };
    syncUser();
  }, [user]);

  return null;
}
