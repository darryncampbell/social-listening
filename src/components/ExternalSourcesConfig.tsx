'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faEdit, faTrash, faPlus, faLock } from '@fortawesome/free-solid-svg-icons';
import { getExternalSources, saveExternalSources, isValidExternalUrl, getSupportedHostsList, ExternalSource } from '@/utils/externalSourcesConfig';
import { fetchEnvConfig, getPredefinedExternalSources, PredefinedExternalSource } from '@/utils/interestConfig';
import ConfirmModal from './ConfirmModal';
import styles from './ExternalSourcesConfig.module.css';

export default function ExternalSourcesConfig() {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [predefinedSources, setPredefinedSources] = useState<PredefinedExternalSource[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewRow, setShowNewRow] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNameError, setNewNameError] = useState('');
  const [newUrlError, setNewUrlError] = useState('');
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const [editUrlError, setEditUrlError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ExternalSource | null>(null);

  useEffect(() => {
    fetchEnvConfig().then(() => {
      setPredefinedSources(getPredefinedExternalSources());
      setSources(getExternalSources());
      setMounted(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (mounted) {
      saveExternalSources(sources);
    }
  }, [sources, mounted]);

  const handleAddNew = () => {
    setShowNewRow(true);
    setNewName('');
    setNewUrl('');
    setNewNameError('');
    setNewUrlError('');
  };

  const handleSaveNew = () => {
    let hasError = false;

    if (!newName.trim()) {
      setNewNameError('Please enter a name');
      hasError = true;
    } else {
      setNewNameError('');
    }

    const urlValidation = isValidExternalUrl(newUrl.trim());
    if (!newUrl.trim()) {
      setNewUrlError('Please enter a URL');
      hasError = true;
    } else if (!urlValidation.valid) {
      setNewUrlError(urlValidation.error || 'Invalid URL');
      hasError = true;
    } else {
      setNewUrlError('');
    }

    if (hasError) return;

    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: newName.trim(), url: newUrl.trim() }
    ]);
    setShowNewRow(false);
    setNewName('');
    setNewUrl('');
  };

  const handleCancelNew = () => {
    setShowNewRow(false);
    setNewName('');
    setNewUrl('');
    setNewNameError('');
    setNewUrlError('');
  };

  const handleEdit = (source: ExternalSource) => {
    setEditingId(source.id);
    setEditName(source.name);
    setEditUrl(source.url);
    setEditNameError('');
    setEditUrlError('');
  };

  const handleSaveEdit = (id: string) => {
    let hasError = false;

    if (!editName.trim()) {
      setEditNameError('Please enter a name');
      hasError = true;
    } else {
      setEditNameError('');
    }

    const urlValidation = isValidExternalUrl(editUrl.trim());
    if (!editUrl.trim()) {
      setEditUrlError('Please enter a URL');
      hasError = true;
    } else if (!urlValidation.valid) {
      setEditUrlError(urlValidation.error || 'Invalid URL');
      hasError = true;
    } else {
      setEditUrlError('');
    }

    if (hasError) return;

    setSources((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, name: editName.trim(), url: editUrl.trim() } : s
      )
    );
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditUrl('');
    setEditNameError('');
    setEditUrlError('');
  };

  const handleDelete = (source: ExternalSource) => {
    setDeleteConfirm(source);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      setSources((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      if (showNewRow) handleCancelNew();
      if (editingId) handleCancelEdit();
    }
  };

  if (!mounted || loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>External Website Sources</h2>
        <p className={styles.description}>Loading...</p>
      </div>
    );
  }

  const hasPredefined = predefinedSources.length > 0;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>External Website Sources</h2>
      <p className={styles.description}>
        Add external website URLs to scrape for content during sync. 
        Supported websites: {getSupportedHostsList()}.
      </p>

      {/* Predefined sources from environment variable */}
      {hasPredefined && (
        <>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Predefined Sources</h3>
            <span className={styles.sectionBadge}>From environment variable</span>
          </div>
          <div className={styles.list}>
            {predefinedSources.map((source) => (
              <div key={source.id} className={`${styles.row} ${styles.rowLocked}`}>
                <div className={styles.lockIndicator} title="Defined by environment variable">
                  <FontAwesomeIcon icon={faLock} />
                </div>
                <div className={styles.fields}>
                  <div className={`${styles.inputWrapper} ${styles.nameWrapper}`}>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputLocked}`}
                      value={source.name}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className={`${styles.inputWrapper} ${styles.urlWrapper}`}>
                    <input
                      type="url"
                      className={`${styles.input} ${styles.inputLocked}`}
                      value={source.url}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
                <div className={styles.actions}>
                  {/* No actions for locked sources */}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom sources section */}
      {hasPredefined && (
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Custom Sources</h3>
        </div>
      )}
      <div className={styles.list}>
        {sources.map((source) => (
          <div key={source.id} className={styles.row}>
            {editingId === source.id ? (
              <>
                <div className={styles.fields}>
                  <div className={`${styles.inputWrapper} ${styles.nameWrapper}`}>
                    <input
                      type="text"
                      className={`${styles.input} ${editNameError ? styles.inputError : ''}`}
                      placeholder="Source name..."
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        if (editNameError) setEditNameError('');
                      }}
                      onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit(source.id))}
                      autoFocus
                    />
                    {editNameError && <span className={styles.error}>{editNameError}</span>}
                  </div>
                  <div className={`${styles.inputWrapper} ${styles.urlWrapper}`}>
                    <input
                      type="url"
                      className={`${styles.input} ${editUrlError ? styles.inputError : ''}`}
                      placeholder="https://..."
                      value={editUrl}
                      onChange={(e) => {
                        setEditUrl(e.target.value);
                        if (editUrlError) setEditUrlError('');
                      }}
                      onKeyDown={(e) => handleKeyDown(e, () => handleSaveEdit(source.id))}
                    />
                    {editUrlError && <span className={styles.error}>{editUrlError}</span>}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={handleCancelEdit}
                    title="Cancel"
                  >
                    ✕
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleSaveEdit(source.id)}
                    title="Save"
                  >
                    <FontAwesomeIcon icon={faSave} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.fields}>
                  <div className={`${styles.inputWrapper} ${styles.nameWrapper}`}>
                    <input
                      type="text"
                      className={styles.input}
                      value={source.name}
                      disabled
                    />
                  </div>
                  <div className={`${styles.inputWrapper} ${styles.urlWrapper}`}>
                    <input
                      type="url"
                      className={styles.input}
                      value={source.url}
                      disabled
                    />
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={() => handleDelete(source)}
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleEdit(source)}
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {showNewRow && (
          <div className={styles.row}>
            <div className={styles.fields}>
              <div className={`${styles.inputWrapper} ${styles.nameWrapper}`}>
                <input
                  type="text"
                  className={`${styles.input} ${newNameError ? styles.inputError : ''}`}
                  placeholder="Source name..."
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (newNameError) setNewNameError('');
                  }}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveNew)}
                  autoFocus
                />
                {newNameError && <span className={styles.error}>{newNameError}</span>}
              </div>
              <div className={`${styles.inputWrapper} ${styles.urlWrapper}`}>
                <input
                  type="url"
                  className={`${styles.input} ${newUrlError ? styles.inputError : ''}`}
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => {
                    setNewUrl(e.target.value);
                    if (newUrlError) setNewUrlError('');
                  }}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveNew)}
                />
                {newUrlError && <span className={styles.error}>{newUrlError}</span>}
              </div>
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={handleCancelNew}
                title="Cancel"
              >
                ✕
              </button>
              <button
                className={styles.actionButton}
                onClick={handleSaveNew}
                title="Save"
              >
                <FontAwesomeIcon icon={faSave} />
              </button>
            </div>
          </div>
        )}

        {!showNewRow && (
          <button className={styles.addButton} onClick={handleAddNew}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add External Website</span>
          </button>
        )}
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title="Delete External Source"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
