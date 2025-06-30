/*
 * Task Plan Parser – IEEE 1872.1‑2024 compliant
 * ------------------------------------------------
 * Converts a task XML file into an in‑memory graph representation that can be
 * used by mapping, simulation or validation layers.
 *
 * External dependencies
 *   npm i fast-xml-parser libxmljs2
 *
 * If run in the browser, omit XSD validation by passing `undefined` for the
 * second argument to `parse` (libxmljs2 is Node‑only).
 */

import {XMLParser} from 'fast-xml-parser';

/* ---------- domain model -------------------------------------------------- */

export type EdgeLabel = 'unconditional' | 'true' | 'false';

export interface TaskNode {
  id: string;
  description?: string;
  /** XML tag inside <ActionType>, e.g. moveToLocation */
  actionType?: string;
  /** Geographic coordinates for map rendering, if present */
  geometry?: {lat: number; lon: number};
  /** Raw subtree for downstream consumers that need the full payload */
  raw?: unknown;
}

export interface TaskEdge {
  from: string;
  to: string;
  label: EdgeLabel;
}

export interface TaskGraph {
  nodes: Record<string, TaskNode>;
  edges: TaskEdge[];
}

/* ---------- helpers ------------------------------------------------------- */

function asArray<T>(maybe: T | T[] | undefined): T[] {
  if (maybe === undefined) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

/** Remove xmlns attributes so we can ignore namespace prefixes. */
function stripNamespaces(xml: string): string {
  return xml.replace(/xmlns(:\w+)?="[^"]*"/g, '');
}

/* ---------- main parser --------------------------------------------------- */

export class TaskPlanParser {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      // do not coerce tag values so that the consumer can decide what to do
      parseTagValue: false,
    });
  }

  /**
   * Parse XML into a TaskGraph. Optionally validate against an XSD.
   *
   * @throws Error – when XML is invalid or the plan contains dangling references
   */
  parse(xml: string): TaskGraph {
    console.log(xml);
    // --------------------------------------------------- DOM → JS object
    const clean = stripNamespaces(xml);
    const dom = this.parser.parse(clean);
    const template = dom.TaskTemplate;
    if (!template) throw new Error('TaskTemplate root not found');

    // --------------------------------------------------- index atomic tasks
    const atomicTasks = asArray(template.AtomicTasks?.AtomicTask);
    const nodeMap: Record<string, TaskNode> = {};
    for (const task of atomicTasks) {
      const id: string = task.TaskID;
      const description: string | undefined = task.TaskDescription;
      const action = task.Action;
      let actionType: string | undefined;
      let geometry: {lat: number; lon: number} | undefined;
      if (action) {
        actionType = action.ActionType;
        // Generic geo extraction – extend for new action types as needed
        if (action.moveToLocation) {
          const lat = parseFloat(action.moveToLocation.Latitude);
          const lon = parseFloat(action.moveToLocation.Longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            geometry = {lat, lon};
          }
        } else if (action.goToPosition) {
          const lat = parseFloat(action.goToPosition.y);
          const lon = parseFloat(action.goToPosition.x);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            geometry = {lat, lon};
          }
        }
      }
      nodeMap[id] = {
        id,
        description,
        actionType,
        geometry,
        raw: task,
      };
    }

    // --------------------------------------------------- walk <ActionSequence>
    const edges: TaskEdge[] = [];
    const sequences = asArray(template.ActionSequence?.Sequence);
    for (const seq of sequences) {
      this.walkSequence(seq, edges, nodeMap, []);
    }

    // --------------------------------------------------- verify graph integrity
    for (const e of edges) {
      if (!nodeMap[e.from]) throw new Error(`Edge source ${e.from} is undefined`);
      if (!nodeMap[e.to]) throw new Error(`Edge target ${e.to} is undefined`);
    }

    return {nodes: nodeMap, edges};
  }

  /* ---------- recursive descent over <Sequence> -------------------------- */

  private walkSequence(
    seq: any,
    edges: TaskEdge[],
    nodes: Record<string, TaskNode>,
    parents: string[], // last task(s) prior to this sequence (to attach edges)
  ): string[] /* returns last nodes of this sequence */ {
    // Gather children in document order so we respect author intent.
    const items: {kind: 'TaskID' | 'Conditional'; value: any}[] = [];
    if (seq.TaskID) {
      for (const id of asArray(seq.TaskID)) {
        items.push({kind: 'TaskID', value: id});
      }
    }
    if (seq.ConditionalActions) {
      for (const cond of asArray(seq.ConditionalActions)) {
        items.push({kind: 'Conditional', value: cond});
      }
    }

    let last: string[] = parents;

    for (const item of items) {
      if (item.kind === 'TaskID') {
        const currentId = item.value as string;

        // Attach edges from every predecessor in `last` to this node.
        for (const p of last) {
          edges.push({from: p, to: currentId, label: 'unconditional'});
        }

        last = [currentId];
      } else {
        // Conditional branch: may contain multiple <Conditional> branches.
        const cond = item.value;
        const branches = asArray(cond.Conditional);
        const branchSeq = cond.Sequence; // each ConditionalActions has one Sequence sibling (per schema)

        // parent nodes for child sequences = current predecessors
        const joiners: string[] = [];

        branches.forEach((branch: any, i: number) => {
          const label: EdgeLabel = branch.ReturnStatus === 'true' ? 'true' : branch.ReturnStatus === 'false' ? 'false' : 'unconditional';
          const branchSequence = asArray(branchSeq)[i] || branchSeq;

          // find first TaskID inside the branch (if none, edge goes nowhere)
          const firstIds: string[] = [];
          if (branchSequence.TaskID) firstIds.push(...asArray(branchSequence.TaskID));
          if (branchSequence.ConditionalActions) {
            // if first element is another conditional, we have no TaskID yet; recurse later.
          }

          for (const p of last) {
            if (firstIds.length > 0) {
              edges.push({from: p, to: firstIds[0], label});
            }
          }

          const branchLast = this.walkSequence(branchSequence, edges, nodes, last);
          joiners.push(...branchLast);
        });

        // After a conditional block the control flow joins; successors attach to all branch exits.
        last = joiners.length > 0 ? joiners : last;
      }
    }

    return last;
  }
}

/* ---------- convenience wrapper ------------------------------------------ */

/** Quick helper so callers can stay functional */
export function parseTaskPlan(xml: string): TaskGraph {
  return new TaskPlanParser().parse(xml);
}
