'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faCircleHalfStroke, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@/context/ThemeContext';
import styles from './ThemeToggle.module.css';

type ThemeMode = 'light' | 'dark' | 'auto';

const themeOptions: { value: ThemeMode; label: string; icon: typeof faSun }[] = [
  { value: 'light', label: 'Light', icon: faSun },
  { value: 'dark', label: 'Dark', icon: faMoon },
  { value: 'auto', label: 'Auto', icon: faCircleHalfStroke },
];

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = themeOptions.find((opt) => opt.value === mode) || themeOptions[2];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value: ThemeMode) => {
    setMode(value);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme selection"
        aria-expanded={isOpen}
      >
        <FontAwesomeIcon icon={currentOption.icon} className={styles.icon} />
        <FontAwesomeIcon icon={faChevronDown} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              className={`${styles.option} ${mode === option.value ? styles.optionActive : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <FontAwesomeIcon icon={option.icon} className={styles.optionIcon} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
