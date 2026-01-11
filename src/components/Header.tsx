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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <button onClick={scrollToTop} className={styles.tableLink}>To Process</button>
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
