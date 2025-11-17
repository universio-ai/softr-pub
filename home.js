<style id="um-gradient-and-cta1">
  /* === 1. Global gradient background (unchanged) === */
  html, body {
    background:
      radial-gradient(1200px 800px at 0% 0%, rgba(214,236,255,.95) 0%, rgba(214,236,255,0) 45%),
      radial-gradient(1100px 720px at 100% 0%, rgba(236,209,255,1) 10%, rgba(236,209,255,0) 70%),
      linear-gradient(to bottom, rgba(248,248,255,0) 0%, rgba(248,248,255,0) 70%, rgba(235,236,240,1) 100%) !important;
    background-repeat: no-repeat !important;
    background-size: cover !important;
    background-color: transparent !important;
  }

  #page-content {
    background: transparent !important;
  }

  /* Keep navigation white */
  [data-block-id="e10d0f66-ec99-43c8-94f1-a44a569bb7ca"],
  [data-block-id="e10d0f66-ec99-43c8-94f1-a44a569bb7ca"] * {
    background: #fff !important;
    background-color: #fff !important;
  }

  /* Force grid1 off red */
  #hero2 {
    background: inherit !important;
    background-color: inherit !important;
  }

  /* Strip inline reds */
  #hero2 *[style*="ff0000"],
  #hero2 *[style*="rgb(255, 0, 0)"] {
    background: inherit !important;
    background-color: inherit !important;
  }

  /* === 2. Unified CTA + Other1 gradient block === */
  #cta1,
  #other1 {
    position: relative;
    background: none !important; /* remove Softr colors */
  }

  /* Shared gradient layer spanning both */
  #cta1::before,
  #other1::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(1200px 800px at 0% 0%, rgba(214,236,255,.95) 0%, rgba(214,236,255,0) 80%),
      radial-gradient(1100px 720px at 100% 0%, rgba(236,209,255,.92) 0%, rgba(236,209,255,0) 100%),
      linear-gradient(to bottom, rgba(248,248,255,0) 0%, rgba(242,242,242,1) 80%, rgba(242,242,242,1) 100%);
    background-repeat: no-repeat;
    background-size: cover;
    background-attachment: fixed;
  }

  /* Connect gradient between both sections */
  #cta1::before {
    border-bottom: none;
  }
  #other1::before {
    margin-top: -1px; /* visually seamless join */
  }

  /* Keep content above gradient */
  #cta1 > *,
  #other1 > * {
    position: relative;
    z-index: 1;
  }

  /* === 3. CTA1 card layout (desktop) === */
  :root {
    --um-cta1-max-w: 620px;
  }

  @media (min-width: 992px) {
    #cta1 .row {
      justify-content: center;
    }

    #cta1 .sw-background-color-ffffff.sw-box-shadow-l {
      max-width: var(--um-cta1-max-w);
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      padding-inline: clamp(20px, 4vw, 48px);
    }

    #cta1 .sw-background-color-ffffff h2,
    #cta1 .sw-background-color-ffffff p {
      max-width: 60ch;
      margin-left: auto;
      margin-right: auto;
    }
  }

  /* === 4. Mobile fix for unified gradient === */
  @media (max-width: 991px) {
    #cta1::before,
    #other1::before {
      background-attachment: scroll !important;
      background-position: center top !important;
      background-size: 200% 200% !important;
      transform: translateY(0);
    }
  }
</style>
