import SiteHeader from "./SiteHeader";

// the star of the jadwal's corners, as on the home map
const CORNER = (
  <>
    <path d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z" />
    <circle r="2" />
  </>
);

/**
 * Every page outside the home map sits on the same leaf: parchment grain, the
 * jadwal (a ruled frame of ink and ochre) with star corners, and a small masthead.
 * The patterns come from sanad-map.css, in the site's own colour tokens.
 */
export default function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-grain" aria-hidden="true" />
      <div className="page-frame" aria-hidden="true">
        {["c1", "c2", "c3", "c4"].map((c) => (
          <svg key={c} className={c} viewBox="-11 -11 22 22">
            {CORNER}
          </svg>
        ))}
      </div>
      <div className="page-body flex flex-1 flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
