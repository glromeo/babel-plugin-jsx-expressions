
        import { signal } from "@preact/signals";
        function App() {
          const props = signal({ class: 'a' });
          return <div {...props.value} />;
        }
    