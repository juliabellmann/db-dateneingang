// pages/form/[id].js


// React-Hooks für State-Management und Side Effects
import { useEffect, useState } from "react";

// Supabase-Client für Authentifizierung und Datenbankzugriffe
import supabase from "../../lib/supabaseClient";

// Next.js Router zum programmgesteuerten Navigieren
import { useRouter } from "next/router";

// Toast-Benachrichtigungen (Feedback für Nutzeraktionen)
// zum Installieren: npm install react-toastify
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Styled Components für Layout und Styling
import styled from "styled-components";

// Eigene Tooltip-Komponente (hier importiert, aktuell nicht verwendet)
//import InfoTooltip from "@/_components/InfoTooltip";


export default function Form() {
  // Router-Instanz für Redirects (z. B. nach dem Speichern)
  const router = useRouter();
  // ID aus der URL (z. B. /form/123 oder /form/new)
  const { id } = router.query;

  // Zustand zum Sperren des Formulars
  const [isReadonly, setIsReadonly] = useState(false);

  // State für lokal ausgewählte Dateien (noch nicht hochgeladen)
  const [files, setFiles] = useState({
    image: null,
    one: null,
    two: null,
    three: null,
  });

  // State für Vorschau-URLs der hochgeladenen Dateien (lokal oder via signed URL)
  const [previews, setPreviews] = useState({
    image: null,
    one: null,
    two: null,
    three: null,
  });

  // Formular-Daten (entspricht im Wesentlichen der DB-Struktur)
  const [formData, setFormData] = useState({
    status: "draft",
    objektbezeichnung: "",
    city: "",


    // Dateipfade aus dem Supabase Storage / Bucket
    image_file_path: null,
    upload_one_path: null,
    upload_two_path: null,
    upload_three_path: null,
  });


  // Hilfsfunktion: signed URL für bestehendes Bild erzeugen
  async function refreshSignedUrl(key, filePath) {
    // Wenn kein Pfad vorhanden ist, Vorschau zurücksetzen
    if (!filePath) {
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }

    // Signed URL mit 10 Minuten Gültigkeit erzeugen
    const { data, error } = await supabase.storage
      .from("form_files")
      .createSignedUrl(filePath, 60 * 10);

    // Fehlerbehandlung
    if (error) {
      console.error("Signed URL Fehler:", error);
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }

    // Vorschau-URL im State speichern
    setPreviews((prev) => ({ ...prev, [key]: data.signedUrl }));
  }

  // Formular aus der Datenbank laden (bei bestehender ID)
  useEffect(() => {
    // Nur laden, wenn eine ID vorhanden ist und es kein neues Formular ist
    if (id && id !== "new") {
      supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .single()
        .then(async ({ data, error }) => {
          if (error) {
            console.error(error);
            return;
          }
          if (data) {
            // Formulardaten in den State übernehmen
            setFormData((prev) => ({ ...prev, ...data }));

            // Formular sperren, wenn Status "submitted"
            if (data.status === "submitted") setIsReadonly(true);

            // Signed URLs für vorhandene Dateien erzeugen
            if (data.image_file_path)
              await refreshSignedUrl("image", data.image_file_path);

            if (data.upload_one_path)
              await refreshSignedUrl("one", data.upload_one_path);

            if (data.upload_two_path)
              await refreshSignedUrl("two", data.upload_two_path);

            if (data.upload_three_path)
              await refreshSignedUrl("three", data.upload_three_path);
          }
        });
    }
  }, [id]);


  // Behandlung der Dateiauswahl im Formular
  async function handleFileChange(key, e) {
  if (isReadonly) return;

  const f = e.target.files?.[0] || null;

  // Falls keine Datei gewählt wurde
  if (!f) {
    setFiles((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: null }));
    return;
  }

  try {
    // 1️⃣ Lokale Vorschau sofort anzeigen
    if (f.type.startsWith("image/")) {
      const localUrl = URL.createObjectURL(f);
      setPreviews((prev) => ({ ...prev, [key]: localUrl }));
    }

    // 2️⃣ Datei direkt hochladen
    const uploadedPath = await uploadFile(f);

    // 3️⃣ Richtigen DB-Feldnamen bestimmen
    let fieldName;

    if (key === "image") {
      fieldName = "image_file_path";
    } else {
      fieldName = `upload_${key}_path`;
    }

    // 4️⃣ FormData aktualisieren
    const updatedFormData = {
      ...formData,
      [fieldName]: uploadedPath,
      status: "draft",
    };

    setFormData(updatedFormData);

    // 5️⃣ Falls neues Formular → zuerst anlegen
    if (id === "new") {
      const { data, error } = await supabase
        .from("forms")
        .insert(updatedFormData)
        .select()
        .single();

      if (error) throw error;

      toast.success("Datei hochgeladen und Formular gespeichert.");

      // Nach erstem Insert auf echte ID wechseln
      router.replace(`/form/${data.id}`);
    } else {
      // 6️⃣ Bestehendes Formular updaten
      const { error } = await supabase
        .from("forms")
        .update(updatedFormData)
        .eq("id", id);

      if (error) throw error;

      toast.success("Datei ausgewählt.");
    }

    // 7️⃣ Signed URL neu erzeugen
    await refreshSignedUrl(key, uploadedPath);

    // 8️⃣ File-Input zurücksetzen
    setFiles((prev) => ({ ...prev, [key]: null }));

  } catch (error) {
    console.error("Auto-Save Fehler:", error);
    toast.error("Automatisches Speichern fehlgeschlagen.");
  }
}


  // Upload ins private Bucket, Pfad = auth.uid()/timestamp-filename
  async function uploadFile(fileToUpload) {
    // Prüfe aktuellen User
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    console.log("uploadFile - auth.getUser result:", userData, userErr);

    // Abbruch, falls kein User eingeloggt ist
    if (userErr || !userData?.user) throw new Error("Nicht eingeloggt");

    const userId = userData.user.id;

    // Baue Dateipfad (wichtig für RLS-Policy wenn Pfad-Check verwendet wird)
    // Dateipfad: userId/timestamp-dateiname
    const filePath = `${userId}/${Date.now()}-${fileToUpload.name}`;
    console.log(
      "uploadFile - filePath:",
      filePath,
      "file type:",
      fileToUpload.type,
    );

    // Upload in den Bucket "form_files"
    const { data, error: upErr } = await supabase.storage
      .from("form_files")
      .upload(filePath, fileToUpload, {
        cacheControl: "3600",
        upsert: false,
        contentType: fileToUpload.type,
      });

    console.log("uploadFile - upload result:", { data, upErr });

    // Fehler weiterwerfen
    if (upErr) throw upErr;
    // Pfad der hochgeladenen Datei zurückgeben
    return filePath;
  }

  // Zwischenspeichern oder Aktualisieren des Formulars
  const handleSave = async () => {

    // Im Readonly-Modus keine Änderungen erlauben
    if (isReadonly) return;

    try {
      // Prüfen, ob User eingeloggt ist
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user) {
        toast.error("Bitte einloggen.");
        return;
      }

      // Aktuelle Dateipfade aus dem Formular
      let {
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      } = formData;

      // Neue Dateien hochladen und Pfade ersetzen
      if (files.image) image_file_path = await uploadFile(files.image);
      if (files.one) upload_one_path = await uploadFile(files.one);
      if (files.two) upload_two_path = await uploadFile(files.two);
      if (files.three) upload_three_path = await uploadFile(files.three);

      // Payload für Insert / Update
      const payload = {
        ...formData,
        user_id: userRes.user.id,
        status: "draft",
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      };

      // Lokale Dateiauswahl zurücksetzen
      setFiles({ image: null, one: null, two: null, three: null });


      // Neues Formular anlegen
      if (id === "new") {
        const { error: insertErr } = await supabase
          .from("forms")
          .insert(payload);
        if (insertErr) throw insertErr;

        toast.success("Formular erfolgreich zwischengespeichert!", {
          position: "top-right",
        });
      } 

      // Bestehendes Formular aktualisieren
      else {
        const { error: updateErr } = await supabase
          .from("forms")
          .update(payload)
          .eq("id", id);
        if (updateErr) throw updateErr;
        toast.success("Änderungen wurden gespeichert.", {
          position: "top-center",
        });
      }

      // Pfade im State aktualisieren
      setFormData((prev) => ({
        ...prev,
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      }));

      // Signed URLs nach dem Upload erneuern
      if (image_file_path) await refreshSignedUrl("image", image_file_path);
      if (upload_one_path) await refreshSignedUrl("one", upload_one_path);
      if (upload_two_path) await refreshSignedUrl("two", upload_two_path);
      if (upload_three_path) await refreshSignedUrl("three", upload_three_path);
    } catch (error) {
      console.error("handleSave error:", error);
      toast.error(
        `Beim Speichern ist ein Fehler aufgetreten: ${error?.message || error}`,
      );
    }
  };

  // Finales Absenden des Formulars
  const handleSubmit = async () => {
    // Keine Aktion im Readonly-Modus
    if (isReadonly) return;

    const { error } = await supabase
      .from("forms")
      .update({ ...formData, status: "submitted" })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Fehler beim Absenden.");
      return;
    }

    // Nach dem Absenden zurück zum Dashboard
    router.push("/dashboard");
  };

  // Öffnet den PDF-Download in einem neuen Tab
  const downloadPdf = () => {
    window.open(`/api/downloadPdf?id=${id}`, "_blank");
  };

  // Download einer einzelnen hochgeladenen Datei
  const handleDownloadFile = async (filePath) => {
    if (!filePath) {
      toast.error("Keine Datei vorhanden.");
      return;
    }

    try {
      // Temporäre Download-URL erzeugen
      const { data, error } = await supabase.storage
        .from("form_files")
        .createSignedUrl(filePath, 60 * 10);

      if (error) throw error;

      // Download per unsichtbarem <a>-Element auslösen
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = filePath.split("/").pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      toast.error("Download fehlgeschlagen.");
    }
  };

  // Dateiname für Anzeige aufbereiten (ohne führende Zahlen)
  const getDisplayFileName = (path) => {
    if (!path) return "";

    const fileName = path.split("/").pop();

    // Entfernt führende Zahlen + "_" oder "-"
    return fileName.replace(/^\d+[_-]/, "");
  };

  return (
    <>
      <StyledSite>
        <h1>Formular</h1>

        {/* Hinweis bei gesperrtem Formular */}
        {isReadonly && (
          <p
            style={{
              backgroundColor: "#eee",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            Dieses Formular wurde bereits eingereicht und ist nicht mehr
            bearbeitbar.
          </p>
        )}

        <form>
          <StyledFieldset>
            <legend>
              <h2>1. Allgemeine Angaben</h2>
            </legend>

            <div className="spacebetween">
              <label htmlFor="objektbezeichnung">
                Objektbezeichnung / Art der Nutzung:{" "}
              </label>
              <input
                id="objektbezeichnung"
                placeholder="Objektbezeichnung"
                value={formData.objektbezeichnung}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    objektbezeichnung: e.target.value,
                  })
                }
                readOnly={isReadonly}
              />
            </div>

            <div className="spacebetween">
              <label htmlFor="city">Stadt: </label>
              <input
                id="city"
                placeholder="Stadt"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                readOnly={isReadonly}
              />
            </div>

          </StyledFieldset>

          <StyledButton
            type="button"
            onClick={handleSave}
            disabled={isReadonly}
          >
            Zwischenspeichern
          </StyledButton>

          <StyledFieldset>
            <legend>
              <h2>6. weitere Projektangaben</h2>
            </legend>

            {["image", "one", "two", "three"].map((key) => {
              const filePath =
                formData[`${key}_file_path`] || formData[`upload_${key}_path`];
              const labelMap = {
                image: "Upload Hauptdatei",
                one: "Upload eins",
                two: "Upload zwei",
                three: "Upload drei",
              };

              return (
                <StyledUploads key={key}>
                  <label>{labelMap[key]}:</label>

                  {/* verstecktes File-Input */}
                  <input
                    type="file"
                    id={`file-${key}`}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(key, e)}
                    disabled={isReadonly}
                  />

                  {/* eigener Button */}
                  <StyledButton
                    type="button"
                    onClick={() =>
                      document.getElementById(`file-${key}`).click()
                    }
                    disabled={isReadonly}
                  >
                    Datei auswählen
                  </StyledButton>

                  {/* Anzeige gewählter Datei oder bestehender Pfad */}
                  <span style={{ marginLeft: "1rem" }}>
                    {files[key]?.name ||
                      (filePath
                        ? getDisplayFileName(filePath)
                        : "Keine Datei ausgewählt")}
                    {filePath && (
                      <small style={{ marginLeft: "0.5rem", color: "#666" }}>
                        ({filePath.split(".").pop().toUpperCase()})
                      </small>
                    )}
                  </span>

                  {/* Vorschau bei Bilddateien */}
                  {previews[key] && (
                    <div style={{ marginTop: "0.5rem" }}>
                      {/* <img src={previews[key]} alt="Vorschau" width={200} /> */}
                    </div>
                  )}

                  {/* Download-Button nur bei readonly */}
                  {isReadonly && filePath && (
                    <StyledButton
                      type="button"
                      onClick={() => handleDownloadFile(filePath)}
                      style={{ marginTop: "0.5rem" }}
                    >
                      Datei herunterladen
                    </StyledButton>
                  )}
                  <br></br>
                  <br></br>
                  <br></br>
                </StyledUploads>
              );
            })}
          </StyledFieldset>

          {/* Buttons deaktivieren, wenn readonly */}
          <StyledButton
            type="button"
            onClick={handleSave}
            disabled={isReadonly}
          >
            Zwischenspeichern
          </StyledButton>
          <StyledButton type="button" onClick={() => router.push("/dashboard")}>
            Zurück zur Übersicht
          </StyledButton>
          <StyledButton
            type="button"
            onClick={handleSubmit}
            disabled={isReadonly}
          >
            Absenden
          </StyledButton>
        </form>

        {/* ⬇️ Zurück-Button nur im readonly-Modus */}
        {isReadonly && (
          <>
            <StyledBackButton
              type="button"
              onClick={() => router.push("/dashboard")}
            >
              Zurück zur Übersicht
            </StyledBackButton>
            <StyledButton type="button" onClick={downloadPdf}>
              PDF herunterladen
            </StyledButton>
          </>
        )}
        <ToastContainer position="top-right" />
      </StyledSite>
    </>
  );
}

// =======================
// Styled Components
// =======================

const StyledSite = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  /* background-color: rgba(180, 229, 240, 0.2);
  margin: 5rem 15rem;
  padding: 0 0 3rem 0; */
`;

const StyledFieldset = styled.fieldset`
  background-color: var(--bg-color-highlight);
  width: 1400px;

  div {
    /* Breite des Inhalts im fieldset */
    width: 50%;
  }
`;

const StyledButton = styled.button`
  background-color: var(--secondary-color);
  color: white;
  border: none;
  padding: 10px 16px;
  margin: 2rem 1rem;
  cursor: pointer;

  &:hover {
    background-color: var(--secondary-color);
    text-decoration: underline;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
    text-decoration: none;
  }
`;

const StyledRadiobuttons = styled.div`
  // background-color: green;
  display: flex;
  justify-content: center;
  gap: 1.5rem;

  label {
    // background-color: red;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 150px;
  }
`;

// Zurück-Button im Readonly-Modus
const StyledBackButton = styled.button`
  background-color: #777;
  color: white;
  border: none;
  padding: 10px 16px;
  margin: 2rem 1rem;
  cursor: pointer;

  &:hover {
    background-color: #555;
  }
`;

// Wrapper für Upload-Bereiche
const StyledUploads = styled.div`
  display: flex;
  flex-direction: column;
`;
