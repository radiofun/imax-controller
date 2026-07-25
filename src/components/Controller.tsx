"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import CrtBarrel from "@/components/CrtBarrel";
import CrtShader from "@/components/CrtShader";
import ShaderControls from "@/components/ShaderControls";
import { DEFAULT_CRT, type CrtSettings } from "@/lib/crtSettings";
import {
  moveMenu,
  moveNav,
  NAV_START,
  stepNav,
  type NavId,
} from "@/lib/panelNav";
import { sfx, unlockAudio } from "@/lib/panelSound";

type Transport = "RUN" | "JOG" | "STOP";
type Overlay = null | "functions" | "alarms" | "shows";

const DEFAULT_SHOWS = [
  "ODYSSEY W/ DUNE 3",
  "DUNE PART TWO",
  "OPPENHEIMER",
  "AVATAR: FIRE AND ASH",
  "INTERSTELLAR",
];

const FLAGS = [
  "Spare",
  "Remote Start Bit",
  "IN SHOW POSITION",
  "REEL UNIT READY",
  "SYSTEM READY",
] as const;

const FUNCTION_BUTTONS = [
  "Lamp On",
  "Lamp Off",
  "Douser Open",
  "Douser Close",
  "Focus +",
  "Focus -",
  "Turret Home",
  "Turret Advance",
  "Splicer Arm",
  "Takeup Engage",
  "Cooling Fan",
  "Aux Relay",
];

const ALARMS = [
  { id: "A01", label: "Lamp Current High", fault: false },
  { id: "A02", label: "Frame Pulse Lost", fault: true },
  { id: "A03", label: "Takeup Tension", fault: false },
  { id: "A04", label: "Door Interlock", fault: false },
  { id: "A05", label: "Cooling Airflow", fault: false },
  { id: "A06", label: "Remote Link Drop", fault: false },
];

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function formatClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(d: Date) {
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${pad(d.getFullYear() % 100)}`;
}

function formatShowTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad(m, 4)}:${pad(s)}`;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function navClass(base: string, id: NavId, focus: NavId, on = false) {
  return `${base}${on ? " on" : ""}${focus === id ? " nav-focus" : ""}`;
}

export default function Controller() {
  const titleRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [transport, setTransport] = useState<Transport>("STOP");
  const [autoMode, setAutoMode] = useState(true);
  const [remoteMode, setRemoteMode] = useState(true);
  const [shows, setShows] = useState<string[]>(() => [...DEFAULT_SHOWS]);
  const [showIndex, setShowIndex] = useState(0);
  const [frameCount, setFrameCount] = useState(255315);
  const [showSeconds, setShowSeconds] = useState(0);
  const [flags, setFlags] = useState<Record<string, boolean>>({
    Spare: false,
    "Remote Start Bit": false,
    "IN SHOW POSITION": true,
    "REEL UNIT READY": false,
    "SYSTEM READY": false,
  });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [focus, setFocus] = useState<NavId>(NAV_START);
  const [log, setLog] = useState<string[]>([
    "PANEL READY",
    "PRESETS COMPLETED",
  ]);
  const [presetsDone, setPresetsDone] = useState(true);
  const [crt, setCrt] = useState<CrtSettings>(DEFAULT_CRT);
  const [showKeys, setShowKeys] = useState(true);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 40));
  }, []);

  const toggleFlag = useCallback((name: string) => {
    setFlags((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      if (next[name]) sfx.on();
      else sfx.off();
      setLog((logPrev) =>
        [`${name}: ${next[name] ? "ON" : "OFF"}`, ...logPrev].slice(0, 40),
      );
      return next;
    });
  }, []);

  const setTransportSafe = useCallback(
    (next: Transport) => {
      if (next === "RUN") sfx.run();
      else if (next === "JOG") sfx.jog();
      else sfx.stop();
      setTransport(next);
      pushLog(`TRANSPORT ${next}`);
      if (next === "STOP") setShowSeconds(0);
    },
    [pushLog],
  );

  const autoLoad = useCallback(() => {
    sfx.load();
    setPresetsDone(false);
    pushLog("AUTO LOAD…");
    window.setTimeout(() => {
      setPresetsDone(true);
      setFlags((f) => ({
        ...f,
        "REEL UNIT READY": true,
        "SYSTEM READY": true,
        "IN SHOW POSITION": true,
      }));
      sfx.ok();
      pushLog("AUTO LOAD COMPLETE");
    }, 900);
  }, [pushLog]);

  const exitShow = useCallback(() => {
    sfx.stop();
    setTransport("STOP");
    setShowSeconds(0);
    setFlags((f) => ({
      ...f,
      "IN SHOW POSITION": false,
      "REEL UNIT READY": false,
      "SYSTEM READY": false,
    }));
    setPresetsDone(false);
    pushLog("EXIT SHOW");
  }, [pushLog]);

  const selectShow = useCallback(
    (i: number) => {
      sfx.ok();
      setShowIndex(i);
      setShowSeconds(0);
      setFrameCount(0);
      setTransport("STOP");
      setShows((list) => {
        pushLog(`SHOW: ${list[i]}`);
        return list;
      });
      setOverlay(null);
    },
    [pushLog],
  );

  const beginEditTitle = useCallback(() => {
    sfx.click();
    setFocus("title");
    requestAnimationFrame(() => {
      const el = titleRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  const setShowTitle = useCallback(
    (value: string) => {
      setShows((list) => {
        const next = [...list];
        next[showIndex] = value;
        return next;
      });
    },
    [showIndex],
  );

  const openShows = useCallback(() => {
    sfx.open();
    setOverlay("shows");
    setMenuIndex(showIndex);
  }, [showIndex]);

  const openFunctions = useCallback(() => {
    sfx.open();
    setOverlay("functions");
    setMenuIndex(0);
  }, []);

  const openAlarms = useCallback(() => {
    sfx.open();
    setOverlay("alarms");
    setMenuIndex(0);
  }, []);

  const toggleMode = useCallback(() => {
    setAutoMode((v) => {
      const next = !v;
      if (next) sfx.on();
      else sfx.off();
      pushLog(next ? "AUTO MODE" : "MANUAL MODE");
      return next;
    });
  }, [pushLog]);

  const toggleRemote = useCallback(() => {
    setRemoteMode((v) => {
      if (v) sfx.off();
      else sfx.on();
      pushLog(v ? "LOCAL MODE" : "REMOTE MODE");
      return !v;
    });
  }, [pushLog]);

  const resetFrames = useCallback(() => {
    sfx.click();
    setFrameCount(0);
    pushLog("FRAME COUNT RESET");
  }, [pushLog]);

  const activateMain = useCallback(
    (id: NavId) => {
      switch (id) {
        case "functions":
          openFunctions();
          break;
        case "alarms":
          openAlarms();
          break;
        case "title":
          beginEditTitle();
          break;
        case "run":
          setTransportSafe("RUN");
          break;
        case "jog":
          setTransportSafe("JOG");
          break;
        case "stop":
          setTransportSafe("STOP");
          break;
        case "remote":
          toggleRemote();
          break;
        case "flag0":
        case "flag1":
        case "flag2":
        case "flag3":
        case "flag4":
          toggleFlag(FLAGS[Number(id.slice(4))]);
          break;
        case "reset":
          resetFrames();
          break;
        case "mode":
          toggleMode();
          break;
        case "autoload":
          autoLoad();
          break;
        case "changeshow":
          openShows();
          break;
        case "exit":
          exitShow();
          break;
      }
    },
    [
      openFunctions,
      openAlarms,
      openShows,
      beginEditTitle,
      setTransportSafe,
      toggleRemote,
      toggleFlag,
      resetFrames,
      toggleMode,
      autoLoad,
      exitShow,
    ],
  );

  const overlayContentCount = (() => {
    if (overlay === "functions") return FUNCTION_BUTTONS.length;
    if (overlay === "shows") return shows.length;
    if (overlay === "alarms") return ALARMS.length;
    return 0;
  })();

  // content items + CLOSE footer
  const overlayCount = overlayContentCount + (overlay ? 1 : 0);

  const overlayCols =
    overlay === "functions" ? 3 : overlay === "shows" ? 3 : 1;

  const activateMenu = useCallback(() => {
    if (!overlay) return;
    const closeIndex = overlayCount - 1;
    if (menuIndex === closeIndex) {
      sfx.close();
      setOverlay(null);
      return;
    }
    if (overlay === "functions") {
      sfx.click();
      pushLog(`FUNC ${FUNCTION_BUTTONS[menuIndex].toUpperCase()}`);
      return;
    }
    if (overlay === "shows") {
      selectShow(menuIndex);
      return;
    }
    if (overlay === "alarms") {
      const a = ALARMS[menuIndex];
      sfx.warn();
      pushLog(`ALARM ${a.id} ACK`);
    }
  }, [overlay, overlayCount, menuIndex, pushLog, selectShow]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (transport !== "RUN") return;
    const id = window.setInterval(() => {
      setShowSeconds((s) => s + 1);
      setFrameCount((f) => f + 24);
    }, 1000);
    return () => window.clearInterval(id);
  }, [transport]);

  // Keep menu cursor in range when overlay changes
  useEffect(() => {
    if (!overlay) return;
    setMenuIndex((i) => Math.min(i, Math.max(0, overlayCount - 1)));
  }, [overlay, overlayCount]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      unlockAudio();
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === "Escape") {
        e.preventDefault();
        if (overlay) {
          sfx.close();
          setOverlay(null);
        } else setTransportSafe("STOP");
        return;
      }

      if (key === "?" || key === "h") {
        e.preventDefault();
        setShowKeys((v) => !v);
        return;
      }

      // ——— Overlay menu navigation ———
      if (overlay) {
        if (
          key === "ArrowUp" ||
          key === "ArrowDown" ||
          key === "ArrowLeft" ||
          key === "ArrowRight"
        ) {
          e.preventDefault();
          const dir =
            key === "ArrowUp"
              ? "up"
              : key === "ArrowDown"
                ? "down"
                : key === "ArrowLeft"
                  ? "left"
                  : "right";
          sfx.nav();
          setMenuIndex((i) =>
            moveMenu(i, overlayCols, overlayContentCount, dir),
          );
          return;
        }
        if (key === "Tab") {
          e.preventDefault();
          sfx.nav();
          setMenuIndex(
            (i) =>
              (i + (e.shiftKey ? -1 : 1) + overlayCount) % overlayCount,
          );
          return;
        }
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          activateMenu();
          return;
        }
        // digit shortcuts inside functions
        if (overlay === "functions") {
          const n = Number(key);
          if (n >= 1 && n <= 9 && n <= FUNCTION_BUTTONS.length) {
            e.preventDefault();
            setMenuIndex(n - 1);
            pushLog(`FUNC ${FUNCTION_BUTTONS[n - 1].toUpperCase()}`);
            return;
          }
        }
        return;
      }

      // ——— Main panel navigation ———
      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight"
      ) {
        e.preventDefault();
        const dir =
          key === "ArrowUp"
            ? "up"
            : key === "ArrowDown"
              ? "down"
              : key === "ArrowLeft"
                ? "left"
                : "right";
        sfx.nav();
        setFocus((f) => moveNav(f, dir));
        return;
      }

      if (key === "Tab") {
        e.preventDefault();
        sfx.nav();
        setFocus((f) => stepNav(f, e.shiftKey ? -1 : 1));
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        activateMain(focus);
        return;
      }

      if (key === " ") {
        e.preventDefault();
        activateMain(focus);
        return;
      }

      switch (key) {
        case "r":
          e.preventDefault();
          setFocus("run");
          setTransportSafe("RUN");
          break;
        case "j":
          e.preventDefault();
          setFocus("jog");
          setTransportSafe("JOG");
          break;
        case "s":
          e.preventDefault();
          setFocus("stop");
          setTransportSafe("STOP");
          break;
        case "t":
          e.preventDefault();
          beginEditTitle();
          break;
        case "f":
          e.preventDefault();
          setFocus("functions");
          openFunctions();
          break;
        case "a":
          e.preventDefault();
          setFocus("alarms");
          openAlarms();
          break;
        case "m":
          e.preventDefault();
          setFocus("mode");
          toggleMode();
          break;
        case "l":
          e.preventDefault();
          setFocus("remote");
          toggleRemote();
          break;
        case "o":
          e.preventDefault();
          setFocus("autoload");
          autoLoad();
          break;
        case "c":
          e.preventDefault();
          setFocus("changeshow");
          openShows();
          break;
        case "e":
          e.preventDefault();
          setFocus("exit");
          exitShow();
          break;
        case "0":
        case "Backspace":
          e.preventDefault();
          setFocus("reset");
          resetFrames();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          e.preventDefault();
          const idx = Number(key) - 1;
          setFocus(`flag${idx}` as NavId);
          toggleFlag(FLAGS[idx]);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [
    overlay,
    overlayCols,
    overlayContentCount,
    overlayCount,
    focus,
    activateMain,
    activateMenu,
    setTransportSafe,
    openFunctions,
    openAlarms,
    openShows,
    beginEditTitle,
    toggleMode,
    toggleRemote,
    autoLoad,
    exitShow,
    resetFrames,
    toggleFlag,
    pushLog,
  ]);

  const modeLabel = autoMode ? "AUTO MODE" : "MANUAL MODE";
  const bloom = crt.bloom;
  const closeIndex = overlayCount - 1;

  return (
    <div
      className="room"
      onPointerDown={unlockAudio}
      style={
        {
          "--crt-bloom": bloom,
          "--glow": `0 0 ${6 * bloom}px rgba(255, 168, 20, ${0.45 + bloom * 0.12}), 0 0 ${16 * bloom}px rgba(255, 140, 0, ${0.18 + bloom * 0.1}), 0 0 ${32 * bloom}px rgba(255, 120, 0, ${0.08 + bloom * 0.06})`,
        } as CSSProperties
      }
    >
      <div className="workspace">
        <div className="stage">
          <div className="bezel">
            <div className="leds" aria-hidden>
              <span className="led" />
              <span className="led blink" />
            </div>

            <div className="screen">
              <CrtBarrel
                amount={crt.curvature}
                resolution={crt.resolution}
              >
              <div className="panel">
                <header className="header">
                  <div>
                    <div className="wordmark">
                      IMAX<sup>®</sup>
                    </div>
                    <div className="title">SHOW LOCAL - {modeLabel}</div>
                  </div>
                  <button
                    type="button"
                    className={navClass(
                      "btn center",
                      "functions",
                      focus,
                      overlay === "functions",
                    )}
                    onClick={() => {
                      setFocus("functions");
                      openFunctions();
                    }}
                  >
                    Functions
                  </button>
                  <button
                    type="button"
                    className={navClass(
                      "btn center",
                      "alarms",
                      focus,
                      overlay === "alarms",
                    )}
                    onClick={() => {
                      setFocus("alarms");
                      openAlarms();
                    }}
                  >
                    Alarms
                  </button>
                </header>

                <div className="body">
                  <div className="left">
                    <section className="fieldset showinfo">
                      <div className="legend">SHOW INFORMATION</div>
                      <div>TRAILER:</div>
                      <div className="title-row">
                        <span>TITLE:</span>
                        <input
                          ref={titleRef}
                          className={`show-title-input${focus === "title" ? " nav-focus" : ""}`}
                          value={shows[showIndex] ?? ""}
                          maxLength={48}
                          spellCheck={false}
                          aria-label="Show title"
                          placeholder="ENTER TITLE"
                          onFocus={() => setFocus("title")}
                          onChange={(e) =>
                            setShowTitle(e.target.value.toUpperCase())
                          }
                          onBlur={() => {
                            setShows((list) => {
                              const next = [...list];
                              const trimmed = (next[showIndex] ?? "").trim();
                              next[showIndex] =
                                trimmed ||
                                DEFAULT_SHOWS[showIndex] ||
                                "UNTITLED";
                              pushLog(`TITLE: ${next[showIndex]}`);
                              return next;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape" || e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </div>
                    </section>

                    <section className="status frame">
                      <div className="row1">
                        <span>STATUS: {modeLabel}</span>
                        <span className={presetsDone ? "" : "dim"}>
                          {presetsDone
                            ? "PRESETS COMPLETED"
                            : "PRESETS PENDING"}
                        </span>
                      </div>
                      <div />
                      <div className="row2">
                        <span>
                          SHOW TIME {formatShowTime(showSeconds)} (MM:SS)
                        </span>
                        <span>DATE {formatDate(now)}</span>
                        <span>TIME {formatClock(now)}</span>
                      </div>
                    </section>

                    <div className="transport">
                      {(["RUN", "JOG", "STOP"] as Transport[]).map((key) => {
                        const id = key.toLowerCase() as NavId;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={navClass(
                              "btn",
                              id,
                              focus,
                              transport === key,
                            )}
                            onClick={() => {
                              setFocus(id);
                              setTransportSafe(key);
                            }}
                          >
                            {key}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className={navClass("banner frame", "remote", focus)}
                      onClick={() => {
                        setFocus("remote");
                        toggleRemote();
                      }}
                    >
                      **&nbsp;&nbsp;
                      {remoteMode ? "REMOTE MODE" : "LOCAL MODE"}
                      &nbsp;&nbsp;**
                    </button>
                  </div>

                  <aside className="right">
                    <div className="flags">
                      {FLAGS.map((name, i) => {
                        const id = `flag${i}` as NavId;
                        return (
                          <button
                            key={name}
                            type="button"
                            className={navClass(
                              "flag",
                              id,
                              focus,
                              flags[name],
                            )}
                            onClick={() => {
                              setFocus(id);
                              toggleFlag(name);
                            }}
                          >
                            <span className="tick" />
                            <span>{name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <section className="lamp frame">
                      <div>LAMP VALUES</div>
                      <div>41.0 V&nbsp;&nbsp;154 A</div>
                    </section>

                    <section className="readout">
                      <div className="cap">FRAME COUNT</div>
                      <div className="val">{frameCount}</div>
                    </section>

                    <button
                      type="button"
                      className={navClass("btn center", "reset", focus)}
                      onClick={() => {
                        setFocus("reset");
                        resetFrames();
                      }}
                    >
                      RESET FRAME COUNT
                    </button>
                  </aside>
                </div>

                <footer className="feet">
                  <section className="fieldset">
                    <div className="legend">Change Mode</div>
                    <button
                      type="button"
                      className={navClass("btn center", "mode", focus, true)}
                      onClick={() => {
                        setFocus("mode");
                        toggleMode();
                      }}
                    >
                      {autoMode ? "MANUAL" : "AUTO"}
                    </button>
                  </section>

                  <button
                    type="button"
                    className={navClass("btn center", "autoload", focus)}
                    onClick={() => {
                      setFocus("autoload");
                      autoLoad();
                    }}
                  >
                    AUTO LOAD
                  </button>

                  <button
                    type="button"
                    className={navClass(
                      "btn center",
                      "changeshow",
                      focus,
                      overlay === "shows",
                    )}
                    onClick={() => {
                      setFocus("changeshow");
                      openShows();
                    }}
                  >
                    Change Show
                  </button>

                  <button
                    type="button"
                    className={navClass("btn center", "exit", focus)}
                    onClick={() => {
                      setFocus("exit");
                      exitShow();
                    }}
                  >
                    Exit Show
                  </button>
                </footer>
              </div>

              {overlay && (
                <div className="overlay" role="dialog" aria-modal="true">
                  <h2>
                    {overlay === "functions" && "FUNCTIONS"}
                    {overlay === "alarms" && "ALARMS"}
                    {overlay === "shows" && "CHANGE SHOW"}
                  </h2>

                  {overlay === "functions" && (
                    <div className="grid">
                      {FUNCTION_BUTTONS.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          className={`btn center${menuIndex === i ? " nav-focus" : ""}`}
                          onClick={() => {
                            setMenuIndex(i);
                            sfx.click();
                            pushLog(`FUNC ${label.toUpperCase()}`);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {overlay === "alarms" && (
                    <div className="alarm-list">
                      {ALARMS.map((a, i) => (
                        <button
                          key={a.id}
                          type="button"
                          className={`alarm${a.fault ? " fault" : ""}${menuIndex === i ? " nav-focus" : ""}`}
                          onClick={() => {
                            setMenuIndex(i);
                            sfx.warn();
                            pushLog(`ALARM ${a.id} ACK`);
                          }}
                        >
                          <span>
                            {a.id} {a.label}
                          </span>
                          <span>{a.fault ? "ACTIVE" : "CLEAR"}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {overlay === "shows" && (
                    <div className="grid">
                      {shows.map((title, i) => (
                        <button
                          key={`${i}-${title}`}
                          type="button"
                          className={`btn center${showIndex === i ? " on" : ""}${menuIndex === i ? " nav-focus" : ""}`}
                          onClick={() => {
                            setMenuIndex(i);
                            selectShow(i);
                          }}
                        >
                          {title || "UNTITLED"}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "end",
                    }}
                  >
                    <div className="log" aria-live="polite">
                      {log.slice(0, 4).map((line, i) => (
                        <div key={`${line}-${i}`} className={i ? "dim" : ""}>
                          {line}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={`btn center on${menuIndex === closeIndex ? " nav-focus" : ""}`}
                      onClick={() => {
                        sfx.close();
                        setOverlay(null);
                      }}
                    >
                      CLOSE
                    </button>
                  </div>
                </div>
              )}
              </CrtBarrel>

              <CrtShader settings={crt} />
            </div>
          </div>
        </div>

        <div className="side-rail">
          <ShaderControls settings={crt} onChange={setCrt} />

          {showKeys && (
            <div className="key-help" aria-label="Keyboard shortcuts">
              <div className="shader-controls-title">KEYS</div>
              <ul>
                <li>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd>
                  <kbd>←</kbd>
                  <kbd>→</kbd> Move
                </li>
                <li>
                  <kbd>Enter</kbd> / <kbd>Space</kbd> Select
                </li>
                <li>
                  <kbd>Tab</kbd> Next control
                </li>
                <li>
                  <kbd>Esc</kbd> Close / Stop
                </li>
                <li>
                  <kbd>R</kbd>
                  <kbd>J</kbd>
                  <kbd>S</kbd> Transport
                </li>
                <li>
                  <kbd>T</kbd> Edit title
                </li>
                <li>
                  <kbd>F</kbd>
                  <kbd>A</kbd>
                  <kbd>C</kbd> Menus
                </li>
                <li>
                  <kbd>M</kbd>
                  <kbd>L</kbd>
                  <kbd>O</kbd>
                  <kbd>E</kbd>
                </li>
                <li>
                  <kbd>1</kbd>–<kbd>5</kbd> Flags · <kbd>0</kbd> Reset
                </li>
                <li>
                  <kbd>H</kbd> Toggle help
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
