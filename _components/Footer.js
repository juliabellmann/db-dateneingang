import { useEffect, useState } from 'react';
import styled from 'styled-components';
import supabase from '../lib/supabaseClient'; // Pfad ggf. anpassen

export default function Footer() {
  const [isCoworker, setIsCoworker] = useState(false);

  useEffect(() => {
    const fetchProfileAndRole = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsCoworker(false);
        return;
      }

      // 🔁 EXAKT wie im Dashboard
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('iscoworker')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Fehler beim Laden des Profils (Footer):', profileError.message || profileError);
        setIsCoworker(false);
        return;
      }

      if (profileData?.iscoworker) {
        setIsCoworker(true);
      } else {
        setIsCoworker(false);
      }
    };

    fetchProfileAndRole();

    // 🔄 reagiert auf Login / Logout – wie Dashboard-Neuladen
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchProfileAndRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
  <StyledFooter $isCoworker={isCoworker}>
    <p>
      {isCoworker ? 'Mitarbeiter Ansicht - reworked' : 'Copyright © BKI - reworked'}
    </p>
  </StyledFooter>
  );
}

const StyledFooter = styled.footer`
  background-color: ${({ $isCoworker }) =>
    $isCoworker ? 'green' : 'var(--primary-color)'};

  color: white;

  margin-top: 4rem;
  padding: 1rem;

  display: flex;
  justify-content: space-evenly;
  align-items: center;

  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;

  height: 50px;
`;
