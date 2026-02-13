'use client';

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faHome, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import styles from './Header.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const JUMP_OPTIONS = [
  { id: 'home', label: 'Home', target: null },
  { id: 'to-process', label: 'To Process', target: '#to-process' },
  { id: 'done', label: 'Done', target: '#done' },
  { id: 'ignored', label: 'Ignored', target: '#ignored' },
  { id: 'metrics', label: 'Metrics', target: '#metrics' },
] as const;

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isConfigPage = pathname === '/config';
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jumpRef.current && !jumpRef.current.contains(event.target as Node)) {
        setJumpOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleJump = (target: string | null) => {
    if (target === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.querySelector(target);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setJumpOpen(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1 className={styles.title}>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={styles.titleLink}
          >
            {isConfigPage ? 'Social Listening: Configuration' : 'Social Listening'}
          </a>
        </h1>
      </div>
      <nav className={styles.nav}>
        {isHomePage && (
          <div className={styles.jumpWrapper} ref={jumpRef}>
            <button
              type="button"
              className={styles.jumpButton}
              onClick={() => setJumpOpen(!jumpOpen)}
              aria-expanded={jumpOpen}
              aria-haspopup="true"
            >
              <span>Jump to</span>
              <FontAwesomeIcon icon={faChevronDown} className={styles.jumpChevron} />
            </button>
            {jumpOpen && (
              <div className={styles.jumpDropdown}>
                {JUMP_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={styles.jumpOption}
                    onClick={() => handleJump(opt.target)}
                  >
                    {opt.id === 'home' && <FontAwesomeIcon icon={faHome} className={styles.jumpOptionIcon} />}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <ThemeToggle />
        {isConfigPage ? (
          <Link href="/" className={styles.iconButton} title="Home">
            <FontAwesomeIcon icon={faHome} />
          </Link>
        ) : (
          <Link href="/config" className={styles.iconButton} title="Settings">
            <FontAwesomeIcon icon={faCog} />
          </Link>
        )}
      </nav>
    </header>
  );
}
