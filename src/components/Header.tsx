'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faHome } from '@fortawesome/free-solid-svg-icons';
import styles from './Header.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isConfigPage = pathname === '/config';

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1 className={styles.title}>
          {isConfigPage ? 'Social Listening: Configuration' : 'Social Listening'}
        </h1>
      </div>
      <nav className={styles.nav}>
        {isHomePage && (
          <div className={styles.tableLinks}>
            <a href="#to-process" className={styles.tableLink}>To Process</a>
            <a href="#done" className={styles.tableLink}>Done</a>
            <a href="#ignored" className={styles.tableLink}>Ignored</a>
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
