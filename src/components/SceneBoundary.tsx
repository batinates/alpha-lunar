import { Component, type ReactNode } from 'react'
export class SceneBoundary extends Component<{children:ReactNode},{error:boolean}>{
  state={error:false}
  static getDerivedStateFromError(){return {error:true}}
  render(){return this.state.error?<div className="scene-error"><strong>Lunar data could not be loaded.</strong><p>Check your connection, then reload the explorer.</p><button onClick={()=>window.location.reload()}>Reload explorer</button></div>:this.props.children}
}
