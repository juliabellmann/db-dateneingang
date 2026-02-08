// pages/form/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import supabase from "../../lib/supabaseClient";
import styled from "styled-components";
// npm install react-toastify
import { toast } from "react-toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import InfoTooltip from "@/_components/InfoTooltip";

// import { useState } from "react";

export default function Form() {
  const router = useRouter();
  const { id } = router.query;

  const [files, setFiles] = useState({
    image: null,
    one: null,
    two: null,
    three: null,
  });

  const [previews, setPreviews] = useState({
    image: null,
    one: null,
    two: null,
    three: null,
  });

  // hier das neue Formularfeld ergänzen
  const [formData, setFormData] = useState({
    status: "draft",

    objektbezeichnung: "",
    // bauherr: "",

    // street: "",
    // housenumber: "",
    // postalcode: "",
    city: "",
    // landkreis: "",
    // bundesland: "",

    // planungsbeginn: "",
    // vergabedatum: "",
    // baubeginn: "",
    // bauende: "",

    // fotograf: "",

    // NE_buero: "",
    // NE_institut: "",
    // NE_krankenhaus: "",
    // NE_pflegeheim: "",
    // NE_schule_schueler: "",
    // NE_schule_klassen: "",
    // NE_kindergarten_kinder: "",
    // NE_kindergarten_gruppen: "",
    // NE_wohngebaude: "",
    // NE_heim: "",
    // NE_versammlungsgebauede: "",
    // NE_gaststaette: "",
    // NE_hotel: "",
    // NE_laborgebaeude: "",
    // NE_produktionsstaette: "",
    // NE_feuerwache: "",
    // NE_parkhaus: "",
    // NE_sonst_anz: "",

    // UGs_anz: "",
    // UGs_beschreibung: "",
    // EGs_anz: "",
    // EGs_beschreibung: "",
    // OGs_anz: "",
    // OGs_beschreibung: "",
    // DGs_anz: "",
    // DGs_beschreibung: "",

    // allgemeine_objektinformation: "",
    // baukonstruktion: "",
    // technische_anlagen: "",
    // beschreibung_sonstiges: "",
    // region: "",
    // konjunktur: "",
    // standard: "",
    // nuf: "",
    // vf: "",
    // tf: "",
    // bgf: "",
    image_file_path: null,
    upload_one_path: null,
    upload_two_path: null,
    upload_three_path: null,
  });

  const [isReadonly, setIsReadonly] = useState(false); // ⬅️ Zustand zum Sperren des Formulars
  // Hilfsfunktion: signed URL für bestehendes Bild erzeugen
  async function refreshSignedUrl(key, filePath) {
    if (!filePath) {
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }

    const { data, error } = await supabase.storage
      .from("form_files")
      .createSignedUrl(filePath, 60 * 10);

    if (error) {
      console.error("Signed URL Fehler:", error);
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }

    setPreviews((prev) => ({ ...prev, [key]: data.signedUrl }));
  }

  // Formular laden
  useEffect(() => {
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
            setFormData((prev) => ({ ...prev, ...data }));
            if (data.status === "submitted") setIsReadonly(true);
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

  // Datei-Auswahl
  function handleFileChange(key, e) {
    const f = e.target.files?.[0] || null;

    setFiles((prev) => ({ ...prev, [key]: f }));

    if (!f) {
      setPreviews((prev) => ({ ...prev, [key]: null }));
      return;
    }

    if (f.type.startsWith("image/")) {
      const localUrl = URL.createObjectURL(f);
      setPreviews((prev) => ({ ...prev, [key]: localUrl }));
    } else {
      setPreviews((prev) => ({ ...prev, [key]: null }));
    }
  }

  // Upload ins private Bucket, Pfad = auth.uid()/timestamp-filename
  async function uploadFile(fileToUpload) {
    // Prüfe aktuellen User
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    console.log("uploadFile - auth.getUser result:", userData, userErr);
    if (userErr || !userData?.user) throw new Error("Nicht eingeloggt");
    const userId = userData.user.id;

    // Baue Dateipfad (wichtig für RLS-Policy wenn Pfad-Check verwendet wird)
    const filePath = `${userId}/${Date.now()}-${fileToUpload.name}`;
    console.log(
      "uploadFile - filePath:",
      filePath,
      "file type:",
      fileToUpload.type,
    );

    const { data, error: upErr } = await supabase.storage
      .from("form_files")
      .upload(filePath, fileToUpload, {
        cacheControl: "3600",
        upsert: false,
        contentType: fileToUpload.type,
      });

    console.log("uploadFile - upload result:", { data, upErr });
    if (upErr) throw upErr;
    return filePath;
  }

  // Speichern (Zwischenspeichern / Aktualisieren)
  const handleSave = async () => {
    if (isReadonly) return;

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user) {
        toast.error("Bitte einloggen.");
        return;
      }

      let {
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      } = formData;

      if (files.image) image_file_path = await uploadFile(files.image);
      if (files.one) upload_one_path = await uploadFile(files.one);
      if (files.two) upload_two_path = await uploadFile(files.two);
      if (files.three) upload_three_path = await uploadFile(files.three);

      const payload = {
        ...formData,
        user_id: userRes.user.id,
        status: "draft",
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      };

      setFiles({ image: null, one: null, two: null, three: null });

      if (id === "new") {
        const { error: insertErr } = await supabase
          .from("forms")
          .insert(payload);
        if (insertErr) throw insertErr;
        toast.success("Formular erfolgreich zwischengespeichert!", {
          position: "top-right",
        });
      } else {
        const { error: updateErr } = await supabase
          .from("forms")
          .update(payload)
          .eq("id", id);
        if (updateErr) throw updateErr;
        toast.success("Änderungen wurden gespeichert.", {
          position: "top-center",
        });
      }
      setFormData((prev) => ({
        ...prev,
        image_file_path,
        upload_one_path,
        upload_two_path,
        upload_three_path,
      }));

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

  // Absenden (final)
  const handleSubmit = async () => {
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
    router.push("/dashboard");
  };

  // PDF Download
  const downloadPdf = () => {
    window.open(`/api/downloadPdf?id=${id}`, "_blank");
  };

  const handleDownloadFile = async (filePath) => {
    if (!filePath) {
      toast.error("Keine Datei vorhanden.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("form_files")
        .createSignedUrl(filePath, 60 * 10);

      if (error) throw error;

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

  const getDisplayFileName = (path) => {
    if (!path) return "";

    const fileName = path.split("/").pop();

    // entfernt führende Zahlen + _ oder -
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

const StyledFieldTooltip = styled.div`
  min-width: 400px;

  display: flex;
`;

const StyledUploads = styled.div`
  display: flex;
  flex-direction: column;
`;
