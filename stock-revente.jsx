
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Camera, Trash2, Search, Package, TrendingUp, Clock, Euro, ImageOff } from "lucide-react";

const STORAGE_KEY = "stock-revente-articles";

const colors = {
  bg: "#1B2430",
  bgSoft: "#232E3D",
  bgSofter: "#2B3648",
  paper: "#E4D9BE",
  paperDark: "#D8CBA0",
  ink: "#1B2430",
  cream: "#F3EEE0",
  green: "#3F7D58",
  greenSoft: "#26382D",
  red: "#B8442F",
  redSoft: "#3A2A26",
  gold: "#B08D3E",
  goldSoft: "#3A331F",
  muted: "#8A93A3",
};

const displayFont = "'Space Grotesk', sans-serif";
const bodyFont = "'Inter', sans-serif";
const monoFont = "'JetBrains Mono', monospace";

function uid() {
  return "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function formatEUR(n) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function emptyForm() {
  return {
    name: "",
    photo: null,
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseAmount: "",
    isOnline: false,
    sold: false,
    saleDate: "",
    saleAmount: "",
  };
}

function StampBadge({ status }) {
  const map = {
    stock: { label: "En stock", color: colors.red, bg: colors.redSoft },
    online: { label: "En ligne", color: colors.green, bg: colors.greenSoft },
    sold: { label: "Vendu", color: colors.gold, bg: colors.goldSoft },
  };
  const s = map[status];
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        background: s.bg,
        border: `1.5px dashed ${s.color}`,
        color: s.color,
        fontFamily: monoFont,
        fontSize: 10,
        letterSpacing: "0.06em",
        padding: "3px 8px",
        borderRadius: 999,
        transform: "rotate(-6deg)",
        fontWeight: 600,
        textTransform: "uppercase",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      {s.label}
    </div>
  );
}

function KpiTag({ icon, label, value, sub, rotate }) {
  return (
    <div
      style={{
        background: colors.paper,
        borderRadius: 10,
        padding: "20px 16px 16px",
        position: "relative",
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: colors.bg,
          border: `2px solid ${colors.paperDark}`,
        }}
      />
      <div className="flex items-center gap-1.5 mb-2" style={{ color: colors.ink, opacity: 0.65 }}>
        {icon}
        <span style={{ fontFamily: monoFont, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 24, color: colors.ink, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: monoFont, fontSize: 11, color: colors.ink, opacity: 0.6, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        setItems(res ? JSON.parse(res.value) : []);
      } catch (err) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persist(updated) {
    setItems(updated);
    try {
      const res = await window.storage.set(STORAGE_KEY, JSON.stringify(updated), true);
      setSaveError(!res);
    } catch (err) {
      setSaveError(true);
    }
  }

  const soldItems = useMemo(() => items.filter((i) => i.saleDate && i.saleAmount != null), [items]);

  const kpis = useMemo(() => {
    if (soldItems.length === 0) {
      return { avgDays: null, avgMarginValue: null, avgMarginPct: null, totalCA: 0 };
    }
    let totalDays = 0,
      daysCount = 0;
    let totalMarginValue = 0;
    let totalMarginPct = 0,
      pctCount = 0;
    let totalCA = 0;
    soldItems.forEach((it) => {
      const purchase = new Date(it.purchaseDate);
      const sale = new Date(it.saleDate);
      const days = Math.round((sale - purchase) / 86400000);
      if (!isNaN(days) && days >= 0) {
        totalDays += days;
        daysCount++;
      }
      const margin = Number(it.saleAmount) - Number(it.purchaseAmount);
      totalMarginValue += margin;
      totalCA += Number(it.saleAmount);
      if (Number(it.purchaseAmount) > 0) {
        totalMarginPct += (margin / Number(it.purchaseAmount)) * 100;
        pctCount++;
      }
    });
    return {
      avgDays: daysCount ? Math.round(totalDays / daysCount) : null,
      avgMarginValue: totalMarginValue / soldItems.length,
      avgMarginPct: pctCount ? totalMarginPct / pctCount : null,
      totalCA,
    };
  }, [soldItems]);

  const counts = useMemo(() => {
    const stock = items.filter((i) => !i.isOnline && !i.saleDate).length;
    const online = items.filter((i) => i.isOnline && !i.saleDate).length;
    const sold = soldItems.length;
    return { all: items.length, stock, online, sold };
  }, [items, soldItems]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "stock") list = list.filter((i) => !i.isOnline && !i.saleDate);
    if (filter === "online") list = list.filter((i) => i.isOnline && !i.saleDate);
    if (filter === "sold") list = list.filter((i) => i.saleDate);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [items, filter, search]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setConfirmDelete(false);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item.name,
      photo: item.photo,
      purchaseDate: item.purchaseDate,
      purchaseAmount: String(item.purchaseAmount),
      isOnline: item.isOnline,
      sold: !!item.saleDate,
      saleDate: item.saleDate || "",
      saleAmount: item.saleAmount != null ? String(item.saleAmount) : "",
    });
    setConfirmDelete(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setConfirmDelete(false);
  }

  async function handlePhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      // silently ignore, keep previous photo
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.purchaseDate || form.purchaseAmount === "") return;
    const newItem = {
      id: editing ? editing.id : uid(),
      name: form.name.trim(),
      photo: form.photo,
      purchaseDate: form.purchaseDate,
      purchaseAmount: parseFloat(form.purchaseAmount) || 0,
      isOnline: form.isOnline,
      saleDate: form.sold && form.saleDate ? form.saleDate : null,
      saleAmount: form.sold && form.saleAmount !== "" ? parseFloat(form.saleAmount) || 0 : null,
      createdAt: editing ? editing.createdAt : Date.now(),
    };
    const updated = editing ? items.map((i) => (i.id === editing.id ? newItem : i)) : [newItem, ...items];
    await persist(updated);
    closeModal();
  }

  async function handleDelete() {
    if (!editing) return;
    const updated = items.filter((i) => i.id !== editing.id);
    await persist(updated);
    closeModal();
  }

  const canSave = form.name.trim() && form.purchaseDate && form.purchaseAmount !== "";

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, fontFamily: bodyFont }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        ::placeholder { color: #7C8496; }
      `}</style>

      {/* Header */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-6">
        <p
          style={{ fontFamily: monoFont, color: colors.gold, letterSpacing: "0.12em" }}
          className="uppercase text-xs mb-2"
        >
          Suivi achat &middot; revente
        </p>
        <h1 style={{ fontFamily: displayFont, color: colors.cream }} className="text-3xl sm:text-4xl font-bold">
          Registre de stock
        </h1>
      </div>

      {/* KPI row */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiTag
          icon={<Euro size={13} />}
          label="Chiffre d'affaires"
          value={formatEUR(kpis.totalCA)}
          sub={`${counts.sold} vente${counts.sold > 1 ? "s" : ""}`}
          rotate={-1.2}
        />
        <KpiTag
          icon={<TrendingUp size={13} />}
          label="Marge moyenne"
          value={kpis.avgMarginValue != null ? formatEUR(kpis.avgMarginValue) : "—"}
          sub="par article vendu"
          rotate={0.8}
        />
        <KpiTag
          icon={<TrendingUp size={13} />}
          label="Marge moyenne"
          value={kpis.avgMarginPct != null ? `${kpis.avgMarginPct >= 0 ? "+" : ""}${Math.round(kpis.avgMarginPct)} %` : "—"}
          sub="sur le prix d'achat"
          rotate={-0.6}
        />
        <KpiTag
          icon={<Clock size={13} />}
          label="Délai moyen de revente"
          value={kpis.avgDays != null ? `${kpis.avgDays} j` : "—"}
          sub="achat → vente"
          rotate={1}
        />
      </div>

      {/* Toolbar */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Tous", count: counts.all },
            { key: "stock", label: "En stock", count: counts.stock },
            { key: "online", label: "En ligne", count: counts.online },
            { key: "sold", label: "Vendus", count: counts.sold },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                background: filter === tab.key ? colors.paper : colors.bgSoft,
                color: filter === tab.key ? colors.ink : colors.muted,
                border: `1px solid ${filter === tab.key ? colors.paper : colors.bgSofter}`,
              }}
              className="px-3 py-1.5 rounded-full transition-colors"
            >
              {tab.label} <span style={{ opacity: 0.6 }}>· {tab.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div
            className="flex items-center gap-2 px-3 rounded-full"
            style={{ background: colors.bgSoft, border: `1px solid ${colors.bgSofter}` }}
          >
            <Search size={14} color={colors.muted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article…"
              style={{ background: "transparent", color: colors.cream, fontFamily: bodyFont, fontSize: 13 }}
              className="py-2 outline-none w-40 sm:w-48"
            />
          </div>
          <button
            onClick={openAdd}
            style={{ background: colors.gold, color: colors.ink, fontFamily: bodyFont, fontWeight: 600 }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap"
          >
            <Plus size={16} /> Ajouter un article
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
        {loading ? (
          <p style={{ color: colors.muted, fontFamily: monoFont }} className="text-sm">
            Chargement du stock…
          </p>
        ) : filtered.length === 0 ? (
          <div
            style={{ border: `1px dashed ${colors.bgSofter}`, color: colors.muted }}
            className="rounded-xl py-16 text-center"
          >
            <Package size={28} className="mx-auto mb-3" style={{ opacity: 0.5 }} />
            <p style={{ fontFamily: bodyFont }} className="text-sm">
              {items.length === 0
                ? "Aucun article pour l'instant."
                : "Aucun article ne correspond à ce filtre."}
            </p>
            {items.length === 0 && (
              <button
                onClick={openAdd}
                style={{ color: colors.gold, fontFamily: monoFont }}
                className="text-xs mt-3 underline"
              >
                Ajouter le premier article
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const status = item.saleDate ? "sold" : item.isOnline ? "online" : "stock";
              const margin = item.saleDate ? Number(item.saleAmount) - Number(item.purchaseAmount) : null;
              const marginPct =
                margin != null && item.purchaseAmount > 0 ? (margin / item.purchaseAmount) * 100 : null;
              return (
                <button
                  key={item.id}
                  onClick={() => openEdit(item)}
                  style={{ background: colors.bgSoft, border: `1px solid ${colors.bgSofter}`, textAlign: "left" }}
                  className="rounded-xl overflow-hidden hover:brightness-110 transition-all"
                >
                  <div style={{ position: "relative", aspectRatio: "1", background: colors.bgSofter }}>
                    {item.photo ? (
                      <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={24} color={colors.muted} />
                      </div>
                    )}
                    <StampBadge status={status} />
                  </div>
                  <div className="p-3.5">
                    <h3
                      style={{ fontFamily: displayFont, color: colors.cream, fontWeight: 700 }}
                      className="text-base mb-1.5 truncate"
                    >
                      {item.name}
                    </h3>
                    <div
                      style={{ fontFamily: monoFont, color: colors.muted, fontSize: 11.5 }}
                      className="flex justify-between mb-0.5"
                    >
                      <span>Achat · {formatDate(item.purchaseDate)}</span>
                      <span>{formatEUR(item.purchaseAmount)}</span>
                    </div>
                    {item.saleDate && (
                      <div
                        style={{ fontFamily: monoFont, color: colors.muted, fontSize: 11.5 }}
                        className="flex justify-between mb-0.5"
                      >
                        <span>Vente · {formatDate(item.saleDate)}</span>
                        <span>{formatEUR(item.saleAmount)}</span>
                      </div>
                    )}
                    {margin != null && (
                      <div
                        style={{
                          fontFamily: monoFont,
                          color: margin >= 0 ? colors.green : colors.red,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                        className="mt-1.5"
                      >
                        {margin >= 0 ? "+" : ""}
                        {formatEUR(margin)} {marginPct != null && `(${margin >= 0 ? "+" : ""}${Math.round(marginPct)}%)`}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {saveError && (
          <p style={{ color: colors.red, fontFamily: monoFont }} className="text-xs mt-4">
            La sauvegarde a échoué. Vérifie ta connexion et réessaie.
          </p>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ background: "rgba(0,0,0,0.6)" }}
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: colors.paper, color: colors.ink, maxHeight: "90vh" }}
            className="w-full max-w-md rounded-xl overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h2 style={{ fontFamily: displayFont, fontWeight: 700 }} className="text-lg">
                {editing ? "Modifier l'article" : "Nouvel article"}
              </h2>
              <button onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-4">
              {/* Photo */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{ background: colors.paperDark, aspectRatio: "16/9" }}
                  className="w-full rounded-lg flex items-center justify-center overflow-hidden relative"
                >
                  {uploading ? (
                    <span style={{ fontFamily: monoFont, fontSize: 12 }}>Chargement…</span>
                  ) : form.photo ? (
                    <img src={form.photo} alt="Aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1" style={{ color: colors.ink, opacity: 0.6 }}>
                      <Camera size={20} />
                      <span style={{ fontFamily: monoFont, fontSize: 11 }}>Ajouter une photo</span>
                    </span>
                  )}
                </button>
              </div>

              {/* Name */}
              <label className="flex flex-col gap-1">
                <span style={{ fontFamily: monoFont, fontSize: 11, opacity: 0.65 }} className="uppercase">
                  Nom de l'article
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex. Sac à main vintage"
                  style={{ background: colors.paperDark, fontFamily: bodyFont }}
                  className="rounded-md px-3 py-2 outline-none text-sm"
                />
              </label>

              {/* Purchase row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span style={{ fontFamily: monoFont, fontSize: 11, opacity: 0.65 }} className="uppercase">
                    Date d'achat
                  </span>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                    style={{ background: colors.paperDark, fontFamily: monoFont }}
                    className="rounded-md px-3 py-2 outline-none text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span style={{ fontFamily: monoFont, fontSize: 11, opacity: 0.65 }} className="uppercase">
                    Montant d'achat €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchaseAmount}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseAmount: e.target.value }))}
                    placeholder="0"
                    style={{ background: colors.paperDark, fontFamily: monoFont }}
                    className="rounded-md px-3 py-2 outline-none text-sm"
                  />
                </label>
              </div>

              {/* Online toggle */}
              <button
                onClick={() => setForm((f) => ({ ...f, isOnline: !f.isOnline }))}
                style={{ background: colors.paperDark }}
                className="flex items-center justify-between rounded-md px-3 py-2.5"
              >
                <span style={{ fontFamily: bodyFont, fontSize: 13.5 }}>Annonce en ligne (publiée)</span>
                <span
                  style={{
                    width: 38,
                    height: 22,
                    borderRadius: 999,
                    background: form.isOnline ? colors.green : colors.red,
                    position: "relative",
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: form.isOnline ? 18 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.15s",
                    }}
                  />
                </span>
              </button>

              {/* Sold toggle */}
              <button
                onClick={() => setForm((f) => ({ ...f, sold: !f.sold }))}
                style={{ background: colors.paperDark }}
                className="flex items-center justify-between rounded-md px-3 py-2.5"
              >
                <span style={{ fontFamily: bodyFont, fontSize: 13.5 }}>Article vendu</span>
                <span
                  style={{
                    width: 38,
                    height: 22,
                    borderRadius: 999,
                    background: form.sold ? colors.gold : "#B7ADA0",
                    position: "relative",
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: form.sold ? 18 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.15s",
                    }}
                  />
                </span>
              </button>

              {form.sold && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span style={{ fontFamily: monoFont, fontSize: 11, opacity: 0.65 }} className="uppercase">
                      Date de vente
                    </span>
                    <input
                      type="date"
                      value={form.saleDate}
                      onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))}
                      style={{ background: colors.paperDark, fontFamily: monoFont }}
                      className="rounded-md px-3 py-2 outline-none text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span style={{ fontFamily: monoFont, fontSize: 11, opacity: 0.65 }} className="uppercase">
                      Montant de vente €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.saleAmount}
                      onChange={(e) => setForm((f) => ({ ...f, saleAmount: e.target.value }))}
                      placeholder="0"
                      style={{ background: colors.paperDark, fontFamily: monoFont }}
                      className="rounded-md px-3 py-2 outline-none text-sm"
                    />
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                {editing ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: monoFont, fontSize: 11.5 }}>Confirmer ?</span>
                      <button
                        onClick={handleDelete}
                        style={{ color: colors.red, fontFamily: monoFont, fontSize: 12 }}
                        className="font-bold underline"
                      >
                        Oui, supprimer
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ fontFamily: monoFont, fontSize: 12, opacity: 0.6 }}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{ color: colors.red }}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  )
                ) : (
                  <span />
                )}
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  style={{
                    background: canSave ? colors.ink : colors.paperDark,
                    color: canSave ? colors.paper : colors.muted,
                    fontFamily: bodyFont,
                    fontWeight: 600,
                  }}
                  className="px-5 py-2 rounded-full text-sm"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
initial commit
