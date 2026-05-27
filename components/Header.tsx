import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-5">
      <Link href="/" aria-label="Home">
        <Image
          src="/assets/logos/core-logo.svg"
          alt="Core logo"
          width={41}
          height={24}
          priority
        />
      </Link>

      <nav>
        <Link
          href="/le-projet"
          className="font-anonymous text-sm uppercase text-background hover:opacity-60 transition-opacity"
        >
          [Le projet]
        </Link>
      </nav>
    </header>
  );
}
