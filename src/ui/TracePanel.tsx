/**
 * Step trace: what happened to one node on the last update, in the
 * mechanism's own terms. Follows the node under the cursor in the diagram.
 */

import type { SimHandle } from './useSimulation';
import { narrate } from './trace';

export function TracePanel({ sim, node }: { sim: SimHandle; node: number | null }) {
  const simulator = sim.simulator;
  const net = sim.network;
  const lines = simulator && net && node !== null && node < net.n ? narrate(simulator, net, node) : null;
  return (
    <div className="panel panel-trace">
      <div className="panel-head">
        <span className="panel-title">Step trace</span>
        <span className="panel-note">
          {sim.params.semantics === 'faithful' ? 'faithful to the reference code' : 'as described in the paper'} ·
          hover a node in the diagram, pause, and step
        </span>
      </div>
      <div className="trace-body">
        {lines ? (
          lines.map((l, i) => (
            <div key={i} className={'trace-line' + (l.emphasis ? ' trace-emph' : '')}>
              {l.text}
            </div>
          ))
        ) : (
          <div className="trace-line trace-muted">hover a node to see how its last update was computed</div>
        )}
      </div>
    </div>
  );
}
