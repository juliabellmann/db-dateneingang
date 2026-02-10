import { useEffect } from "react";
import styled from "styled-components";
import supabase from "../lib/supabaseClient";
import Navi from "./Navi";
import Footer from "./Footer";

export default function Layout({ children }) {
  useEffect(() => {
    const applyRoleTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        document.documentElement.removeAttribute("data-role");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("iscoworker")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Layout role fetch error:", error);
        document.documentElement.removeAttribute("data-role");
        return;
      }

      if (profile?.iscoworker) {
        document.documentElement.setAttribute("data-role", "coworker");
      } else {
        document.documentElement.removeAttribute("data-role");
      }
    };

    applyRoleTheme();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(() => {
        applyRoleTheme();
      });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Navi />
      <Main>{children}</Main>
      <Footer />
    </>
  );
}

const Main = styled.main`
  flex: 1;
  padding-bottom: 8rem;
`;
