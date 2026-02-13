'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faUndo, faPlus, faXmark, faLock } from '@fortawesome/free-solid-svg-icons';
import { 
  getInterest, 
  saveInterest, 
  resetInterest, 
  DEFAULT_INTEREST,
  getRecognizedUsers,
  addRecognizedUser,
  removeRecognizedUser,
  fetchEnvConfig,
  isInterestEnvOverridden,
  RecognizedUser,
  getPredefinedRecognizedUsers,
  PredefinedRecognizedUser,
} from '@/utils/interestConfig';
import styles from './InterestConfig.module.css';

export default function InterestConfig() {
  const [interest, setInterest] = useState('');
  const [saved, setSaved] = useState(false);
  const [recognizedUsers, setRecognizedUsers] = useState<RecognizedUser[]>([]);
  const [predefinedUsers, setPredefinedUsers] = useState<PredefinedRecognizedUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newRealName, setNewRealName] = useState('');
  const [isEnvOverridden, setIsEnvOverridden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch env config first, then get interest value
    fetchEnvConfig().then(() => {
      setInterest(getInterest());
      setIsEnvOverridden(isInterestEnvOverridden());
      setRecognizedUsers(getRecognizedUsers());
      setPredefinedUsers(getPredefinedRecognizedUsers());
      setLoading(false);
    });
  }, []);

  const handleSave = () => {
    if (!interest.trim()) return;
    saveInterest(interest);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetInterest();
    setInterest(DEFAULT_INTEREST);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInterest(e.target.value);
    setSaved(false);
  };

  const handleAddUser = () => {
    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) return;
    
    // Check if already exists in custom users (case-insensitive, ignoring u/ prefix)
    const normalizedNew = trimmedUsername.toLowerCase().replace(/^u\//, '');
    if (recognizedUsers.some(u => 
      u.username.toLowerCase().replace(/^u\//, '') === normalizedNew
    )) {
      setNewUsername('');
      setNewRealName('');
      return;
    }

    // Also check predefined users
    if (predefinedUsers.some(u => 
      u.username.toLowerCase().replace(/^u\//, '') === normalizedNew
    )) {
      setNewUsername('');
      setNewRealName('');
      return;
    }
    
    addRecognizedUser(trimmedUsername, newRealName.trim());
    setRecognizedUsers(getRecognizedUsers());
    setNewUsername('');
    setNewRealName('');
  };

  const handleRemoveUser = (username: string) => {
    removeRecognizedUser(username);
    setRecognizedUsers(getRecognizedUsers());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUser();
    }
  };

  const isDefault = interest === DEFAULT_INTEREST;
  const hasPredefinedUsers = predefinedUsers.length > 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Company or Person of Interest</h2>
        <p className={styles.description}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Company or Person of Interest</h2>
      <p className={styles.description}>
        Entries mentioning this name will be tagged with a &quot;Mentions [name]&quot; label.
      </p>
      
      {isEnvOverridden && (
        <div className={styles.envOverrideNotice}>
          <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />
          <span>This value is set by the <code>SOCIAL_LISTENING_INTEREST</code> environment variable and cannot be changed here.</span>
        </div>
      )}
      
      <div className={styles.inputRow}>
        <input
          type="text"
          value={interest}
          onChange={handleChange}
          placeholder="e.g., Acme Corp, Jane Smith"
          className={`${styles.input} ${isEnvOverridden ? styles.inputDisabled : ''}`}
          disabled={isEnvOverridden}
          readOnly={isEnvOverridden}
        />
        
        {!isEnvOverridden && (
          <>
            <button
              className={`${styles.actionButton} ${styles.saveButton} ${saved ? styles.saved : ''}`}
              onClick={handleSave}
              disabled={!interest.trim()}
              title="Save"
            >
              <FontAwesomeIcon icon={faCheck} />
              <span>{saved ? 'Saved!' : 'Save'}</span>
            </button>

            {!isDefault && (
              <button
                className={`${styles.actionButton} ${styles.resetButton}`}
                onClick={handleReset}
                title="Reset to default"
              >
                <FontAwesomeIcon icon={faUndo} />
                <span>Reset</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Recognized Users Subsection */}
      <div className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Recognized Users (Reddit only)</h3>
        <p className={styles.subsectionDescription}>
          List of usernames treated as &quot;recognized users&quot;. Add a real name to display alongside the username.
        </p>

        {/* Predefined users from environment variable */}
        {hasPredefinedUsers && (
          <>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Predefined Users</h4>
              <span className={styles.sectionBadge}>From environment variable</span>
            </div>
            <div className={styles.userList}>
              {predefinedUsers.map((user) => (
                <div key={`env-${user.username}`} className={`${styles.userTag} ${styles.userTagLocked}`}>
                  <FontAwesomeIcon icon={faLock} className={styles.userLockIcon} />
                  <span className={styles.userName}>
                    {user.username}
                    {user.realName && <span className={styles.userRealName}> ({user.realName})</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Custom users section */}
        {hasPredefinedUsers && (
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Custom Users</h4>
          </div>
        )}
        
        <div className={styles.userInputRow}>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Username (e.g., u/johndoe)"
            className={`${styles.input} ${styles.usernameInput}`}
          />
          <input
            type="text"
            value={newRealName}
            onChange={(e) => setNewRealName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Real name (optional)"
            className={`${styles.input} ${styles.realNameInput}`}
          />
          <button
            className={`${styles.actionButton} ${styles.addButton}`}
            onClick={handleAddUser}
            disabled={!newUsername.trim()}
            title="Add user"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Add</span>
          </button>
        </div>

        {recognizedUsers.length > 0 && (
          <div className={styles.userList}>
            {recognizedUsers.map((user) => (
              <div key={user.username} className={styles.userTag}>
                <span className={styles.userName}>
                  {user.username}
                  {user.realName && <span className={styles.userRealName}> ({user.realName})</span>}
                </span>
                <button
                  className={styles.removeUserBtn}
                  onClick={() => handleRemoveUser(user.username)}
                  title={`Remove ${user.username}`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ))}
          </div>
        )}

        {recognizedUsers.length === 0 && !hasPredefinedUsers && (
          <p className={styles.emptyList}>No recognized users added yet.</p>
        )}
      </div>
    </div>
  );
}
