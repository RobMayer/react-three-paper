import React, { useEffect, useRef, useCallback, useState } from "react";

type tPaperRenderLoop = (time?: number) => void;
type tPaperCleanup = () => void;
type tPaperChangeHandler<T extends {[key: string]: any}> = (props: Partial<T>) => void;

type tPaperScriptReturn<T extends { [key: string]: any }> = {
  render: tPaperRenderLoop;
  cleanup?: tPaperCleanup;
  onChange?: tPaperChangeHandler<T>
};

type tPaperScript<T extends { [key: string]: any }> = (canvas?: HTMLCanvasElement, initialProps?: T) => Promise<tPaperScriptReturn<T>>;
type tPaperPositionEvent = (entry: IntersectionObserverEntry) => void;
type tPaperErrorEvent = (error: Error) => void;

type iPaperPropTypes<T extends { [key: string]: any }> = {
  script: tPaperScript<T>;
  onExit?: tPaperPositionEvent;
  onEntry?: tPaperPositionEvent;
  onError?: tPaperErrorEvent;
  style?: React.CSSProperties;
  className?: string;
} & T

const IntersectionObserverOptions = {
  threshold: 0.01,
};

export function Paper<T extends { [key: string]: any }>({ script, style, onExit, onEntry, onError, className, ...props }: iPaperPropTypes<T>) {
  const ref = useRef(null);
  const [scriptReturn, setScriptReturn] = useState(null as tPaperScriptReturn<T>);

  const prevProps = useRef<any>(props);
  useEffect(() => {
    if (prevProps.current) {
      const allKeys = Object.keys({ ...prevProps.current, ...props });
      const changesObj: any = {};
      allKeys.forEach((key) => {
        if (prevProps.current[key] !== props[key]) {
          changesObj[key] = props[key];
        }
        prevProps.current[key] = props[key];
      });
      if (Object.keys(changesObj).length) {
        scriptReturn.onChange?.(changesObj as T);
      }
    }
  }, [scriptReturn, props]);

  const execScript = useCallback(async (promise: Promise<tPaperScriptReturn<T>>, callback: tPaperErrorEvent) => {
    try {
      const r = await promise;
      setScriptReturn(r);
    } catch (error) {
      callback(error);
    }
  }, []);

  useEffect(() => {
    let ID: number = 0;

    if (scriptReturn === null) {
      execScript(script(ref.current, prevProps.current), (error: Error) => {
        console.error(error);
        cancelAnimationFrame(ID);
        if (onError) onError(error);
      });
    } else {
      const { render, cleanup } = scriptReturn;

      function animate(time: number) {
        render(time);
        ID = requestAnimationFrame(animate);
      }

      let observer = new IntersectionObserver(([entry]) => {
        const { isIntersecting } = entry;
        if (isIntersecting) {
          if (onEntry) onEntry(entry);
          ID = requestAnimationFrame(animate);
        } else {
          if (onExit) onExit(entry);
          cancelAnimationFrame(ID);
        }
      }, IntersectionObserverOptions);

      observer.observe(ref.current);

      return () => {
        observer.disconnect();
        if (ID) cancelAnimationFrame(ID);
        if (cleanup) cleanup();
      };
    }
  }, [script, ref, scriptReturn]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
}
