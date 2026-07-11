/* ═══════════════════════════════════════════════════════════════════════
   tenant-config.js — QuoteStudio multi-tenant configuratielaag
   ───────────────────────────────────────────────────────────────────────
   Levert het globale TC-object dat index.html verwacht:

     TC.get(key)        → string, met {token}-interpolatie
     TC.logoPdf()       → logo-HTML/SVG voor PDF & preview
     TC.pdfFooter()     → voettekst onderaan PDF-pagina's
     TC.tenant          → id van de actieve tenant (bv. "ricoh")
     TC.all()           → volledig config-object van actieve tenant
     TC.set(id)         → wissel actieve tenant (+ herbrandt de UI)
     TC.apply()         → past kleur/titel/theme-color/manifest toe
     TC.load(supabase)  → async: overschrijf statische config uit Supabase

   Tenant-resolutie (eerste match wint):
     1. ?tenant=<id> in de URL
     2. localStorage "qs_tenant"
     3. subdomein  (ricoh.quotestudio.app → "ricoh")
     4. fallback   → "ricoh"  (backward compatibility — Tenant 0)
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  /* ── Ricoh-merklogo's (referentie-implementatie, ongewijzigd) ── */
  var RICOH_LOGO       = '<svg viewBox="0 0 141 62" xmlns="http://www.w3.org/2000/svg" style="display:block;height:100%;width:auto"><path d="M57.5419 22.2138C57.5419 26.3565 60.5865 29.4106 65.6773 29.4106C67.8267 29.4106 69.8481 29.0699 71.9398 28.0893L73.8498 30.7029C71.2137 32.1032 68.6806 32.8428 64.7862 32.8428C56.6673 32.8428 50.6978 28.9037 50.6978 22.2179C50.6978 15.528 56.6632 11.5931 64.7862 11.5931C68.6765 11.5931 70.9166 12.1623 73.6559 13.3466L71.7046 16.3549C69.6295 15.2455 67.8267 15.017 65.6773 15.017C60.5865 15.017 57.5419 18.071 57.5419 22.2096" fill="#D31D3F"/> <path d="M88.5159 11.5889C80.6569 11.5889 74.9885 15.5322 74.9885 22.2179C74.9885 28.9037 80.6569 32.847 88.5159 32.847C96.3749 32.847 102.047 28.9078 102.047 22.2179C102.047 15.528 96.379 11.5889 88.5159 11.5889ZM88.5159 29.5353C84.1924 29.5353 81.8079 26.2651 81.8079 22.2096C81.8079 18.1541 84.1965 14.884 88.5159 14.884C92.8352 14.884 95.228 18.1583 95.228 22.2096C95.228 26.261 92.8393 29.5353 88.5159 29.5353Z" fill="#D31D3F"/> <path d="M122.481 23.7554V32.3068H128.978V12.1208H122.481V19.8204H112.555V12.1208H106.074V32.3068H112.555V23.7554H122.481Z" fill="#D31D3F"/> <path d="M46.7786 12.1208H39.9386V32.3068H46.7786V12.1208Z" fill="#D31D3F"/> <path d="M20.3179 21.362V23.29C23.5316 25.7956 26.8113 29.1281 29.2165 32.3027H36.8733C34.2083 29.1488 30.1241 25.405 27.1125 23.5185C30.648 23.3731 34.5837 21.9312 34.5837 17.8467C34.5837 12.6069 29.0226 11.6429 23.3996 11.6429C18.8079 11.6429 14.5752 11.8548 12.0339 12.0667V32.3027H18.4243V15.1125C19.6 14.9837 20.8748 14.8424 23.4285 14.8424C26.7165 14.8424 28.3831 15.9394 28.3831 17.8467C28.3831 19.4797 27.6942 21.4326 20.3179 21.3578" fill="#D31D3F"/> <path d="M12.5496 38.361H14.1833V39.9566H12.5496V38.361ZM12.5496 41.6519H14.1833V49.8792H12.5496V41.6519Z" fill="#898B8E"/> <path d="M26.4153 49.8792V44.5979C26.4153 43.5965 26.1059 42.7738 24.959 42.7738C23.6182 42.7738 23.1479 44.1326 23.1479 45.3999V49.8834H21.5142V44.6021C21.5142 43.6007 21.2048 42.778 20.0621 42.778C18.7213 42.778 18.2304 44.1367 18.2304 45.4041V49.8875H16.5967V43.5508C16.5967 42.9234 16.5802 42.2835 16.5142 41.6602H18.0489L18.0984 43.0771C18.6388 42.0259 19.4886 41.4982 20.5984 41.4982C21.8897 41.4982 22.7395 42.271 22.9829 43.1769C23.3748 42.1547 24.4392 41.4982 25.4829 41.4982C27.261 41.4982 28.0614 42.7156 28.0614 44.411V49.8917H26.4112L26.4153 49.8792Z" fill="#898B8E"/> <path d="M100.162 49.8792L100.113 48.5786C98.945 50.7768 94.8361 50.5441 94.8361 47.706C94.8361 45.5661 96.8699 44.6894 100.063 44.8431C100.063 44.8306 100.236 43.2974 99.1884 42.8237C98.5036 42.5162 97.0391 42.5619 95.8014 43.2974L95.7024 42.03C97.6001 41.2405 101.668 40.7461 101.668 44.5564V48.0509C101.668 48.7615 101.701 49.3183 101.767 49.8792H100.162ZM98.5655 48.8404C99.766 48.5537 100.117 47.3362 100.067 45.8445C100.067 45.8445 96.3584 45.5453 96.4574 47.6146C96.5151 48.828 97.6785 49.0523 98.5655 48.8404Z" fill="#898B8E"/> <path d="M35.0293 49.8792L34.9798 48.5786C33.8122 50.7768 29.7033 50.5441 29.7033 47.706C29.7033 45.5661 31.733 44.6894 34.9302 44.8431C34.9302 44.8306 35.1035 43.2974 34.0515 42.8237C33.3667 42.5162 31.9022 42.5619 30.6645 43.2974L30.5655 42.03C32.4632 41.2405 36.5309 40.7461 36.5309 44.5564V48.0509C36.5309 48.7615 36.5639 49.3183 36.6299 49.8792H35.0293ZM33.4286 48.8404C34.6291 48.5537 34.9798 47.3362 34.9302 45.8445C34.9302 45.8445 31.2215 45.5453 31.3205 47.6146C31.3782 48.828 32.5416 49.0523 33.4286 48.8404Z" fill="#898B8E"/> <path d="M113.186 53.1702L113.285 51.7698C114.003 52.148 114.869 52.3765 115.719 52.364C118.545 52.3183 118.384 49.9582 118.384 48.4498C118.384 48.4498 117.567 49.8751 115.851 49.8834C113.467 49.8917 112.534 47.7933 112.534 45.7365C112.534 43.5467 113.467 41.4898 115.884 41.4898C117.01 41.4898 117.926 41.9843 118.45 43.019V41.6519H120.018V49.418C120.018 54.0012 115.971 54.0386 113.19 53.1702M116.359 42.753C114.675 42.753 114.3 44.3652 114.3 45.7489C114.3 47.0329 114.692 48.6119 116.342 48.6119C117.992 48.6119 118.434 46.9997 118.434 45.7489C118.434 44.4317 117.943 42.753 116.359 42.753Z" fill="#898B8E"/> <path d="M38.9154 53.1702L39.0145 51.7698C39.7323 52.148 40.5986 52.3765 41.4485 52.364C44.2744 52.3183 44.1135 49.9582 44.1135 48.4498C44.1135 48.4498 43.2967 49.8751 41.5805 49.8834C39.196 49.8917 38.2636 47.7933 38.2636 45.7365C38.2636 43.5467 39.196 41.4898 41.6135 41.4898C42.7397 41.4898 43.6556 41.9843 44.1795 43.019V41.6519H45.7472V49.418C45.7472 54.0012 41.7001 54.0386 38.9196 53.1702M42.0879 42.753C40.4047 42.753 40.0293 44.3652 40.0293 45.7489C40.0293 47.0329 40.4212 48.6119 42.0714 48.6119C43.7216 48.6119 44.163 46.9997 44.163 45.7489C44.163 44.4317 43.6721 42.753 42.0879 42.753Z" fill="#898B8E"/> <path d="M48.1606 38.361H49.7943V39.9566H48.1606V38.361ZM48.1606 41.6519H49.7943V49.8792H48.1606V41.6519Z" fill="#898B8E"/> <path d="M123.446 46.1935C123.541 49.069 126.082 49.4305 128.347 48.3335L128.446 49.6174C125.162 50.6895 121.763 50.0579 121.763 45.7365C121.763 43.4802 123.186 41.4898 125.455 41.4898C129.304 41.4898 128.871 46.1935 128.871 46.1935H123.446ZM125.476 42.6242C124.086 42.6242 123.434 44.1242 123.434 45.1755H127.308C127.308 44.0079 126.866 42.6242 125.476 42.6242Z" fill="#898B8E"/> <path d="M62.5791 46.1935C62.674 49.069 65.2153 49.4305 67.4801 48.3335L67.5791 49.6174C64.2953 50.6895 60.8959 50.0579 60.8959 45.7365C60.8959 43.4802 62.3192 41.4898 64.5882 41.4898C68.4372 41.4898 68.0041 46.1935 68.0041 46.1935H62.5791ZM64.6047 42.6242C63.2144 42.6242 62.5626 44.1242 62.5626 45.1755H66.4323C66.4323 44.0079 65.9908 42.6242 64.6006 42.6242" fill="#898B8E"/> <path d="M71.7624 48.1839H70.0132V49.8792H71.7624V48.1839Z" fill="#898B8E"/> <path d="M77.5298 45.7323C77.5298 41.9885 81.1107 40.7835 84.2336 41.8306L84.1346 43.1478C82.0925 42.1879 79.2955 42.7863 79.2955 45.7323C79.2955 48.6784 81.9646 49.4055 84.1511 48.4291L84.2336 49.7296C81.647 50.6189 77.5298 49.9374 77.5298 45.7323Z" fill="#898B8E"/> <path d="M90.3888 41.4898C89.2461 41.4898 88.3632 42.0009 87.8558 43.019V38.361H86.2221V49.8792H87.8558V45.5703C87.8558 44.2863 88.3467 42.7696 89.8484 42.7696C91.251 42.7696 91.4656 43.85 91.4656 45.0218V49.8751H93.1157V44.6769C93.1157 42.7987 92.3484 41.4857 90.3888 41.4857" fill="#898B8E"/> <path d="M109.135 45.0259C109.135 43.8749 108.925 42.7738 107.518 42.7738C106 42.7738 105.525 44.17 105.525 45.4664V49.8834H103.891V43.5467C103.891 42.9192 103.875 42.2793 103.809 41.656H105.344L105.393 43.073C105.95 42.0342 106.862 41.494 108.042 41.494C110.067 41.494 110.785 42.7946 110.785 44.6852V49.8875H109.135V45.0259Z" fill="#898B8E"/> <path d="M57.4965 45.0259C57.4965 43.8749 57.2861 42.7738 55.8793 42.7738C54.3612 42.7738 53.8867 44.17 53.8867 45.4664V49.8834H52.2531V43.5467C52.2531 42.9192 52.2366 42.2793 52.1705 41.656H53.7052L53.7547 43.073C54.3117 42.0342 55.2275 41.494 56.4033 41.494C58.4289 41.494 59.1467 42.7946 59.1467 44.6852V49.8875H57.4965V45.0259Z" fill="#898B8E"/> <path d="M132.629 48.1839H130.88V49.8792H132.629V48.1839Z" fill="#898B8E"/></svg>';
  var RICOH_LOGO_WHITE = '<svg viewBox="0 0 141 62" xmlns="http://www.w3.org/2000/svg" style="display:block;height:100%;width:auto"><path d="M57.5419 22.2138C57.5419 26.3565 60.5865 29.4106 65.6773 29.4106C67.8267 29.4106 69.8481 29.0699 71.9398 28.0893L73.8498 30.7029C71.2137 32.1032 68.6806 32.8428 64.7862 32.8428C56.6673 32.8428 50.6978 28.9037 50.6978 22.2179C50.6978 15.528 56.6632 11.5931 64.7862 11.5931C68.6765 11.5931 70.9166 12.1623 73.6559 13.3466L71.7046 16.3549C69.6295 15.2455 67.8267 15.017 65.6773 15.017C60.5865 15.017 57.5419 18.071 57.5419 22.2096" fill="#D31D3F"/> <path d="M88.5159 11.5889C80.6569 11.5889 74.9885 15.5322 74.9885 22.2179C74.9885 28.9037 80.6569 32.847 88.5159 32.847C96.3749 32.847 102.047 28.9078 102.047 22.2179C102.047 15.528 96.379 11.5889 88.5159 11.5889ZM88.5159 29.5353C84.1924 29.5353 81.8079 26.2651 81.8079 22.2096C81.8079 18.1541 84.1965 14.884 88.5159 14.884C92.8352 14.884 95.228 18.1583 95.228 22.2096C95.228 26.261 92.8393 29.5353 88.5159 29.5353Z" fill="#D31D3F"/> <path d="M122.481 23.7554V32.3068H128.978V12.1208H122.481V19.8204H112.555V12.1208H106.074V32.3068H112.555V23.7554H122.481Z" fill="#D31D3F"/> <path d="M46.7786 12.1208H39.9386V32.3068H46.7786V12.1208Z" fill="#D31D3F"/> <path d="M20.3179 21.362V23.29C23.5316 25.7956 26.8113 29.1281 29.2165 32.3027H36.8733C34.2083 29.1488 30.1241 25.405 27.1125 23.5185C30.648 23.3731 34.5837 21.9312 34.5837 17.8467C34.5837 12.6069 29.0226 11.6429 23.3996 11.6429C18.8079 11.6429 14.5752 11.8548 12.0339 12.0667V32.3027H18.4243V15.1125C19.6 14.9837 20.8748 14.8424 23.4285 14.8424C26.7165 14.8424 28.3831 15.9394 28.3831 17.8467C28.3831 19.4797 27.6942 21.4326 20.3179 21.3578" fill="#D31D3F"/> <path d="M12.5496 38.361H14.1833V39.9566H12.5496V38.361ZM12.5496 41.6519H14.1833V49.8792H12.5496V41.6519Z" fill="#898B8E"/> <path d="M26.4153 49.8792V44.5979C26.4153 43.5965 26.1059 42.7738 24.959 42.7738C23.6182 42.7738 23.1479 44.1326 23.1479 45.3999V49.8834H21.5142V44.6021C21.5142 43.6007 21.2048 42.778 20.0621 42.778C18.7213 42.778 18.2304 44.1367 18.2304 45.4041V49.8875H16.5967V43.5508C16.5967 42.9234 16.5802 42.2835 16.5142 41.6602H18.0489L18.0984 43.0771C18.6388 42.0259 19.4886 41.4982 20.5984 41.4982C21.8897 41.4982 22.7395 42.271 22.9829 43.1769C23.3748 42.1547 24.4392 41.4982 25.4829 41.4982C27.261 41.4982 28.0614 42.7156 28.0614 44.411V49.8917H26.4112L26.4153 49.8792Z" fill="#898B8E"/> <path d="M100.162 49.8792L100.113 48.5786C98.945 50.7768 94.8361 50.5441 94.8361 47.706C94.8361 45.5661 96.8699 44.6894 100.063 44.8431C100.063 44.8306 100.236 43.2974 99.1884 42.8237C98.5036 42.5162 97.0391 42.5619 95.8014 43.2974L95.7024 42.03C97.6001 41.2405 101.668 40.7461 101.668 44.5564V48.0509C101.668 48.7615 101.701 49.3183 101.767 49.8792H100.162ZM98.5655 48.8404C99.766 48.5537 100.117 47.3362 100.067 45.8445C100.067 45.8445 96.3584 45.5453 96.4574 47.6146C96.5151 48.828 97.6785 49.0523 98.5655 48.8404Z" fill="#898B8E"/> <path d="M35.0293 49.8792L34.9798 48.5786C33.8122 50.7768 29.7033 50.5441 29.7033 47.706C29.7033 45.5661 31.733 44.6894 34.9302 44.8431C34.9302 44.8306 35.1035 43.2974 34.0515 42.8237C33.3667 42.5162 31.9022 42.5619 30.6645 43.2974L30.5655 42.03C32.4632 41.2405 36.5309 40.7461 36.5309 44.5564V48.0509C36.5309 48.7615 36.5639 49.3183 36.6299 49.8792H35.0293ZM33.4286 48.8404C34.6291 48.5537 34.9798 47.3362 34.9302 45.8445C34.9302 45.8445 31.2215 45.5453 31.3205 47.6146C31.3782 48.828 32.5416 49.0523 33.4286 48.8404Z" fill="#898B8E"/> <path d="M113.186 53.1702L113.285 51.7698C114.003 52.148 114.869 52.3765 115.719 52.364C118.545 52.3183 118.384 49.9582 118.384 48.4498C118.384 48.4498 117.567 49.8751 115.851 49.8834C113.467 49.8917 112.534 47.7933 112.534 45.7365C112.534 43.5467 113.467 41.4898 115.884 41.4898C117.01 41.4898 117.926 41.9843 118.45 43.019V41.6519H120.018V49.418C120.018 54.0012 115.971 54.0386 113.19 53.1702M116.359 42.753C114.675 42.753 114.3 44.3652 114.3 45.7489C114.3 47.0329 114.692 48.6119 116.342 48.6119C117.992 48.6119 118.434 46.9997 118.434 45.7489C118.434 44.4317 117.943 42.753 116.359 42.753Z" fill="#898B8E"/> <path d="M38.9154 53.1702L39.0145 51.7698C39.7323 52.148 40.5986 52.3765 41.4485 52.364C44.2744 52.3183 44.1135 49.9582 44.1135 48.4498C44.1135 48.4498 43.2967 49.8751 41.5805 49.8834C39.196 49.8917 38.2636 47.7933 38.2636 45.7365C38.2636 43.5467 39.196 41.4898 41.6135 41.4898C42.7397 41.4898 43.6556 41.9843 44.1795 43.019V41.6519H45.7472V49.418C45.7472 54.0012 41.7001 54.0386 38.9196 53.1702M42.0879 42.753C40.4047 42.753 40.0293 44.3652 40.0293 45.7489C40.0293 47.0329 40.4212 48.6119 42.0714 48.6119C43.7216 48.6119 44.163 46.9997 44.163 45.7489C44.163 44.4317 43.6721 42.753 42.0879 42.753Z" fill="#898B8E"/> <path d="M48.1606 38.361H49.7943V39.9566H48.1606V38.361ZM48.1606 41.6519H49.7943V49.8792H48.1606V41.6519Z" fill="#898B8E"/> <path d="M123.446 46.1935C123.541 49.069 126.082 49.4305 128.347 48.3335L128.446 49.6174C125.162 50.6895 121.763 50.0579 121.763 45.7365C121.763 43.4802 123.186 41.4898 125.455 41.4898C129.304 41.4898 128.871 46.1935 128.871 46.1935H123.446ZM125.476 42.6242C124.086 42.6242 123.434 44.1242 123.434 45.1755H127.308C127.308 44.0079 126.866 42.6242 125.476 42.6242Z" fill="#898B8E"/> <path d="M62.5791 46.1935C62.674 49.069 65.2153 49.4305 67.4801 48.3335L67.5791 49.6174C64.2953 50.6895 60.8959 50.0579 60.8959 45.7365C60.8959 43.4802 62.3192 41.4898 64.5882 41.4898C68.4372 41.4898 68.0041 46.1935 68.0041 46.1935H62.5791ZM64.6047 42.6242C63.2144 42.6242 62.5626 44.1242 62.5626 45.1755H66.4323C66.4323 44.0079 65.9908 42.6242 64.6006 42.6242" fill="#898B8E"/> <path d="M71.7624 48.1839H70.0132V49.8792H71.7624V48.1839Z" fill="#898B8E"/> <path d="M77.5298 45.7323C77.5298 41.9885 81.1107 40.7835 84.2336 41.8306L84.1346 43.1478C82.0925 42.1879 79.2955 42.7863 79.2955 45.7323C79.2955 48.6784 81.9646 49.4055 84.1511 48.4291L84.2336 49.7296C81.647 50.6189 77.5298 49.9374 77.5298 45.7323Z" fill="#898B8E"/> <path d="M90.3888 41.4898C89.2461 41.4898 88.3632 42.0009 87.8558 43.019V38.361H86.2221V49.8792H87.8558V45.5703C87.8558 44.2863 88.3467 42.7696 89.8484 42.7696C91.251 42.7696 91.4656 43.85 91.4656 45.0218V49.8751H93.1157V44.6769C93.1157 42.7987 92.3484 41.4857 90.3888 41.4857" fill="#898B8E"/> <path d="M109.135 45.0259C109.135 43.8749 108.925 42.7738 107.518 42.7738C106 42.7738 105.525 44.17 105.525 45.4664V49.8834H103.891V43.5467C103.891 42.9192 103.875 42.2793 103.809 41.656H105.344L105.393 43.073C105.95 42.0342 106.862 41.494 108.042 41.494C110.067 41.494 110.785 42.7946 110.785 44.6852V49.8875H109.135V45.0259Z" fill="#898B8E"/> <path d="M57.4965 45.0259C57.4965 43.8749 57.2861 42.7738 55.8793 42.7738C54.3612 42.7738 53.8867 44.17 53.8867 45.4664V49.8834H52.2531V43.5467C52.2531 42.9192 52.2366 42.2793 52.1705 41.656H53.7052L53.7547 43.073C54.3117 42.0342 55.2275 41.494 56.4033 41.494C58.4289 41.494 59.1467 42.7946 59.1467 44.6852V49.8875H57.4965V45.0259Z" fill="#898B8E"/> <path d="M132.629 48.1839H130.88V49.8792H132.629V48.1839Z" fill="#898B8E"/></svg>';

  /* ═══════════════════════════════════════════════════════════════
     1. TENANT-REGISTER  (statische fallback / offline-modus)
        Supabase kan deze waarden runtime overschrijven via TC.load().
     ═══════════════════════════════════════════════════════════════ */
  var TENANTS = {

    /* ── Tenant 0 : Ricoh — mag NIET regresseren ─────────────────── */
    ricoh: {
      slug:             "ricoh",
      companyName:      "Ricoh Belgium NV",
      companyNameShort: "Ricoh",
      primaryColor:     "#BE1622",
      website:          "www.ricoh.be",
      address:          "",   /* TODO: officieel maatschappelijk adres */
      rszLabel:         "Inschrijvingsnummer bij de RSZ",
      rszNumber:        "",   /* TODO: RSZ-nummer */
      vatLabel:         "Ondernemingsnummer bij de BTW",
      vatNumber:        "",   /* TODO: BE 0xxx.xxx.xxx */
      signingLegalUrl:  "",   /* TODO: URL algemene voorwaarden */
      contactSubtitle:  "Uw aanspreekpunten bij {companyNameShort}",
      pwaName:          "Ricoh Offerte Studio Pro v5",
      pwaShortName:     "Ricoh Offerte",
      logo:             RICOH_LOGO,
      logoWhite:        RICOH_LOGO_WHITE,
      pdfFooter:        "{companyName} — {website}"
    },

    /* ── Standaard white-label sjabloon voor nieuwe tenants ──────── */
    "default": {
      slug:             "default",
      companyName:      "QuoteStudio Demo BV",
      companyNameShort: "QuoteStudio",
      primaryColor:     "#2563eb",
      website:          "www.quotestudio.app",
      address:          "",
      rszLabel:         "Inschrijvingsnummer bij de RSZ",
      rszNumber:        "",
      vatLabel:         "Ondernemingsnummer bij de BTW",
      vatNumber:        "",
      signingLegalUrl:  "",
      contactSubtitle:  "Uw aanspreekpunten bij {companyNameShort}",
      pwaName:          "QuoteStudio — Offerte Studio",
      pwaShortName:     "QuoteStudio",
      logo:             "",          /* leeg → auto-wordmark (zie logoPdf) */
      logoWhite:        "",
      pdfFooter:        "{companyName} — {website}"
    }

    /* Nieuwe tenants voeg je hier toe volgens hetzelfde patroon,
       óf — beter — als rij in de Supabase 'tenants'-tabel (TC.load). */
  };

  /* ═══════════════════════════════════════════════════════════════
     2. HULPFUNCTIES
     ═══════════════════════════════════════════════════════════════ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* {token} → waarde uit de tenant; max. 3 niveaus diep (voorkomt loops) */
  function interp(str, t, depth) {
    if (typeof str !== "string" || str.indexOf("{") === -1) return str;
    if (depth == null) depth = 0;
    if (depth > 3) return str;
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      var v = t[k];
      return v == null ? "" : interp(String(v), t, depth + 1);
    });
  }

  function resolveTenantId() {
    /* 1. expliciete override in de URL */
    try {
      var q = new URLSearchParams(global.location.search).get("tenant");
      if (q && TENANTS[q]) return q;
    } catch (e) {}
    /* 2. door de app gezette voorkeur */
    try {
      var ls = global.localStorage.getItem("qs_tenant");
      if (ls && TENANTS[ls]) return ls;
    } catch (e) {}
    /* 3. subdomein */
    try {
      var host = global.location.hostname.split(".");
      if (host.length > 2 && TENANTS[host[0]]) return host[0];
    } catch (e) {}
    /* 4. backward-compatible fallback */
    return TENANTS.ricoh ? "ricoh" : "default";
  }

  /* ═══════════════════════════════════════════════════════════════
     3. HET TC-OBJECT
     ═══════════════════════════════════════════════════════════════ */
  var TC = {
    tenant: resolveTenantId(),

    all: function () {
      return TENANTS[TC.tenant] || TENANTS["default"];
    },

    get: function (key) {
      var t = TC.all();
      var v = t[key];
      if (v == null) return "";
      return interp(v, t);
    },

    logoPdf: function () {
      var t = TC.all();
      if (t.logo) return t.logo;
      /* geen SVG → automatische woordmerk-fallback in de merkkleur */
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:20px;letter-spacing:-.5px;color:' + t.primaryColor + '">'
           + esc(t.companyNameShort) + '</span>';
    },

    logoWhitePdf: function () {
      var t = TC.all();
      if (t.logoWhite) return t.logoWhite;
      return '<span style="font-family:Inter,Arial,sans-serif;font-weight:800;'
           + 'font-size:20px;letter-spacing:-.5px;color:#fff">'
           + esc(t.companyNameShort) + '</span>';
    },

    pdfFooter: function () {
      var t = TC.all();
      return interp(t.pdfFooter || "{companyName}", t);
    },

    /* Wissel actieve tenant en herbrand de UI */
    set: function (id) {
      if (!TENANTS[id]) { console.warn("[TC] onbekende tenant:", id); return; }
      TC.tenant = id;
      try { global.localStorage.setItem("qs_tenant", id); } catch (e) {}
      TC.apply();
    },

    /* Registreer/overschrijf een tenant runtime (gebruikt door TC.load) */
    register: function (id, cfg) {
      TENANTS[id] = Object.assign({}, TENANTS[id] || {}, cfg, { slug: id });
    },

    /* Pas kleur, documenttitel, theme-color en manifest toe op de pagina */
    apply: function () {
      var t = TC.all();
      try {
        var root = document.documentElement;
        root.style.setProperty("--red", t.primaryColor);
        /* lichte tint (rl) afgeleid van de merkkleur */
        root.style.setProperty("--rl", hexToRgba(t.primaryColor, 0.08));
      } catch (e) {}
      try {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", t.primaryColor);
      } catch (e) {}
      try {
        if (document.title && /QuoteStudio/i.test(document.title)) {
          document.title = (t.pwaName || t.companyNameShort) + " — Offerte Studio";
        }
      } catch (e) {}
      TC.applyManifest();
    },

    /* Genereer een tenant-specifieke manifest en hang hem in de <head> */
    applyManifest: function () {
      try {
        var t = TC.all();
        var base = (function () {
          try { return new URL(".", global.location.href).pathname; }
          catch (e) { return "/"; }
        })();
        var mf = {
          name:             t.pwaName || (t.companyNameShort + " — Offerte Studio"),
          short_name:       t.pwaShortName || t.companyNameShort,
          description:      "Professionele offertetool — " + t.companyName,
          start_url:        base,
          scope:            base,
          display:          "standalone",
          background_color:  t.primaryColor,
          theme_color:       t.primaryColor,
          orientation:      "any",
          lang:             "nl",
          icons: [
            { src: base + "icon192.png",        sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: base + "icon512.png",        sizes: "512x512", type: "image/png", purpose: "any maskable" },
            { src: base + "appletouchicon.png", sizes: "180x180", type: "image/png" }
          ],
          categories: ["business", "productivity"]
        };
        var blob = new Blob([JSON.stringify(mf)], { type: "application/manifest+json" });
        var url  = URL.createObjectURL(blob);
        var link = document.querySelector('link[rel="manifest"]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          document.head.appendChild(link);
        }
        link.href = url;
      } catch (e) { /* manifest optioneel — nooit blokkeren */ }
    },

    /* ── Async: overschrijf statische config met een Supabase-rij ──
       Verwacht een geïnitialiseerde supabase-js client.
       Tabel 'tenants' met kolom 'slug' (zie supabase/tenants.sql). */
    load: async function (supa) {
      try {
        if (!supa || !supa.from) return TC.all();
        var res = await supa.from("tenants").select("*").eq("slug", TC.tenant).maybeSingle();
        if (res && res.data) {
          TC.register(TC.tenant, mapRow(res.data));
          TC.apply();
        }
      } catch (e) {
        console.log("[TC] Supabase-config overslaan:", e && e.message);
      }
      return TC.all();
    }
  };

  /* DB-kolommen → config-sleutels (snake_case → camelCase waar nodig) */
  function mapRow(r) {
    var out = {};
    var map = {
      company_name: "companyName", company_name_short: "companyNameShort",
      primary_color: "primaryColor", website: "website", address: "address",
      rsz_label: "rszLabel", rsz_number: "rszNumber",
      vat_label: "vatLabel", vat_number: "vatNumber",
      signing_legal_url: "signingLegalUrl", contact_subtitle: "contactSubtitle",
      pwa_name: "pwaName", pwa_short_name: "pwaShortName",
      logo_svg: "logo", logo_svg_white: "logoWhite", pdf_footer: "pdfFooter"
    };
    Object.keys(map).forEach(function (k) {
      if (r[k] != null && r[k] !== "") out[map[k]] = r[k];
    });
    return out;
  }

  function hexToRgba(hex, a) {
    try {
      hex = String(hex).replace("#", "");
      if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(hex, 16);
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    } catch (e) { return "rgba(37,99,235," + a + ")"; }
  }

  /* ═══════════════════════════════════════════════════════════════
     4. INITIALISATIE — brand direct toepassen (script staat in <head>)
     ═══════════════════════════════════════════════════════════════ */
  global.TC = TC;
  function boot() { try { TC.apply(); } catch (e) {} }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
    /* documentElement bestaat al → kleur alvast zetten tegen flikkering */
    try { document.documentElement.style.setProperty("--red", TC.all().primaryColor); } catch (e) {}
  } else {
    boot();
  }

})(typeof window !== "undefined" ? window : this);
