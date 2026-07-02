function App(): React.JSX.Element {
  const { versions } = window.api

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">AgentDeck</h1>
        <p className="mt-2 text-zinc-400">Mission control for your coding agents</p>
        <p className="mt-8 text-xs text-zinc-600">
          Electron {versions.electron} · Chrome {versions.chrome} · Node {versions.node}
        </p>
      </div>
    </div>
  )
}

export default App
