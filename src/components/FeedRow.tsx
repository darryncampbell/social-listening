'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import styles from './FeedRow.module.css';
import ConfirmModal from './ConfirmModal';

interface FeedRowProps {
  initialTitle?: string;
  initialUrl?: string;
  isEditing?: boolean;
  isNew?: boolean;
  onSave: (title: string, url: string) => void;
  onDelete?: () => void;
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function FeedRow({ 
  initialTitle = '', 
  initialUrl = '', 
  isEditing: initialEditing = true,
  isNew = false,
  onSave,
  onDelete
}: FeedRowProps) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [titleError, setTitleError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    let hasError = false;

    if (!title.trim()) {
      setTitleError('Please enter a title');
      hasError = true;
    } else {
      setTitleError('');
    }

    if (!url.trim()) {
      setUrlError('Please enter a URL');
      hasError = true;
    } else if (!isValidUrl(url.trim())) {
      setUrlError('Please enter a valid URL (e.g., https://example.com/feed.xml)');
      hasError = true;
    } else {
      setUrlError('');
    }

    if (hasError) return;

    setIsEditing(false);
    onSave(title.trim(), url.trim());
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className={styles.row}>
        <div className={styles.fields}>
          <div className={`${styles.inputWrapper} ${styles.titleWrapper}`}>
            <input
              type="text"
              className={`${styles.input} ${titleError ? styles.inputError : ''}`}
              placeholder="Feed title..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              aria-label="Feed title"
            />
            {titleError && <span className={styles.error}>{titleError}</span>}
          </div>
          <div className={`${styles.inputWrapper} ${styles.urlWrapper}`}>
            <input
              type="url"
              className={`${styles.input} ${urlError ? styles.inputError : ''}`}
              placeholder="RSS feed URL..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={handleKeyDown}
              disabled={!isEditing}
              aria-label="RSS feed URL"
            />
            {urlError && <span className={styles.error}>{urlError}</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {isEditing && !isNew && onDelete && (
            <button
              className={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={handleDeleteClick}
              title="Delete"
              aria-label="Delete feed"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          )}
          <button
            className={styles.actionButton}
            onClick={isEditing ? handleSave : handleEdit}
            title={isEditing ? 'Save' : 'Edit'}
            aria-label={isEditing ? 'Save feed' : 'Edit feed'}
          >
            <FontAwesomeIcon icon={isEditing ? faSave : faEdit} />
          </button>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Feed"
          message={`Are you sure you want to delete "${title || 'this feed'}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </>
  );
}
