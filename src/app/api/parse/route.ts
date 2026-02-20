import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import * as dot from 'graphlib-dot';
import * as parser from '@solidity-parser/parser';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('file') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        // Create temp directory
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auditgraph-'));
        const filePaths: string[] = [];
        const fileContents: Map<string, string> = new Map();

        // Save files
        // Save files and handle ZIPs
        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name;
            const filePath = path.join(tmpDir, fileName);

            if (fileName.endsWith('.zip')) {
                // Handle ZIP
                await fs.writeFile(filePath, buffer);
                const zip = new AdmZip(filePath);
                zip.extractAllTo(tmpDir, true);

                // Recursively find .sol files in tmpDir
                async function getSolFiles(dir: string): Promise<string[]> {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    const files: string[] = [];
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            files.push(...await getSolFiles(fullPath));
                        } else if (entry.isFile() && entry.name.endsWith('.sol')) {
                            files.push(fullPath);
                        }
                    }
                    return files;
                }

                const extractedFiles = await getSolFiles(tmpDir);
                for (const solFile of extractedFiles) {
                    filePaths.push(solFile);
                    const content = await fs.readFile(solFile, 'utf-8');
                    fileContents.set(solFile, content);
                }

            } else {
                // Handle single .sol
                const content = buffer.toString('utf-8');
                await fs.writeFile(filePath, buffer);
                filePaths.push(filePath);
                fileContents.set(filePath, content);
            }
        }

        // Run Surya Graph
        // Run Surya Graph
        // Resolve path to surya's executable script directly, bypassing .bin symlinks
        // Vercel might not preserve .bin or permissions correctly
        const suryaPackagePath = require.resolve('surya/package.json');
        const suryaPath = path.join(path.dirname(suryaPackagePath), 'bin', 'surya');
        const command = `node "${suryaPath}" graph ${filePaths.map(p => `"${p}"`).join(' ')}`;

        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stdout) {
            console.error('Surya Error:', stderr);
            return NextResponse.json({ error: 'Failed to generate graph', details: stderr }, { status: 500 });
        }

        // Parse AST to extract code AND identify contract kinds
        const codeMap = new Map<string, string>(); // "Contract.Function" -> Source Code
        const contractKindMap = new Map<string, string>(); // "Contract" -> "interface" | "contract" | "library"
        const callsMap = new Map<string, { name: string; line: number }[]>();

        for (const filePath of filePaths) {
            const content = fileContents.get(filePath) || '';
            try {
                const ast = parser.parse(content, { loc: true, range: true });

                parser.visit(ast, {
                    ContractDefinition: function (node: any) {
                        const contractName = node.name;
                        const kind = node.kind;
                        contractKindMap.set(contractName, kind);

                        for (const subNode of node.subNodes) {
                            if (subNode.type === 'FunctionDefinition') {
                                const funcName = subNode.name || (subNode.isConstructor ? 'constructor' : subNode.isFallback ? 'fallback' : 'receive');
                                const key = `${contractName}.${funcName}`;

                                // Extract source code
                                if (subNode.loc) {
                                    const startLine = subNode.loc.start.line - 1;
                                    const endLine = subNode.loc.end.line;
                                    const lines = content.split('\n');
                                    const funcCode = lines.slice(startLine, endLine).join('\n');
                                    codeMap.set(key, funcCode);

                                    // Extract Function Calls within this function
                                    const calls: { name: string; line: number }[] = [];
                                    try {
                                        parser.visit(subNode, {
                                            FunctionCall: function (callNode: any) {
                                                // Case 1: obj.method() -> MemberAccess
                                                if (callNode.expression && callNode.expression.type === 'MemberAccess') {
                                                    const methodName = callNode.expression.memberName;
                                                    const relativeLine = callNode.loc.start.line - subNode.loc.start.line;
                                                    calls.push({ name: methodName, line: relativeLine });
                                                }
                                                // Case 2: method() -> Identifier
                                                else if (callNode.expression && callNode.expression.type === 'Identifier') {
                                                    const methodName = callNode.expression.name;
                                                    const relativeLine = callNode.loc.start.line - subNode.loc.start.line;
                                                    calls.push({ name: methodName, line: relativeLine });
                                                }
                                            }
                                        });
                                        callsMap.set(key, calls);
                                    } catch (err) {
                                        // Ignore traversal errors
                                    }
                                }
                            }
                        }
                    }
                });
            } catch (e) {
                console.warn('Failed to parse AST for code extraction:', e);
            }
        }

        // parse the DOT output
        // Strip out the "Legend" subgraph which contains HTML labels that might crash graphlib-dot
        const cleanDot = stdout.replace(/subgraph cluster_01 \{[\s\S]*?\}/g, '');
        const graph = dot.read(cleanDot);

        // Transform to React Flow
        const nodes: any[] = [];
        const edges: any[] = [];
        const nodeMap = new Map<string, string>(); // name -> id

        // Graphlib returns a graph object. We iterate over nodes and edges.
        const graphNodes = graph.nodes() as string[];

        // Track created groups
        // Helper to normalize IDs
        const normalizeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');

        // First pass: Identify Clusters (Groups)
        const clusters = new Set<string>();
        const clusterLabelMap = new Map<string, string>();
        const clusterIsInterfaceMap = new Map<string, boolean>();

        // In graphlib-dot returning from surya:
        // Clusters are naturally parents. 
        // We need to iterate all nodes, find their parent.

        graphNodes.forEach((nodeName) => {
            if (nodeName.includes('Legend') || nodeName.startsWith('key')) return;

            const parent = graph.parent(nodeName);
            if (parent) {
                let label = parent;
                if (label.startsWith('cluster_')) label = label.substring(8);
                if (label.startsWith('cluster')) label = label.substring(7);

                const isInterface = contractKindMap.get(label) === 'interface';

                if (!clusters.has(parent)) {
                    clusters.add(parent);
                    clusterLabelMap.set(parent, label);
                    clusterIsInterfaceMap.set(parent, isInterface);
                }
            }
        });

        // Create Group Nodes (Only for strict contracts)
        clusters.forEach(clusterName => {
            const groupId = normalizeId(clusterName);
            nodeMap.set(clusterName, groupId);

            const isInterface = clusterIsInterfaceMap.get(clusterName) || false;

            nodes.push({
                id: groupId,
                position: { x: 0, y: 0 },
                data: {
                    label: clusterLabelMap.get(clusterName) || clusterName,
                    isInterface,
                },
                type: 'group',
                style: {
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(51, 65, 85, 1)',
                    borderRadius: '12px',
                    width: 200,
                    height: 200,
                },
            });
        });

        // Create Function Nodes
        graphNodes.forEach((nodeName, index) => {
            if (nodeName.includes('Legend') || nodeName.startsWith('key')) return;
            if (clusters.has(nodeName)) return;

            // Check if parent is ignored (Interface)

            const label = graph.node(nodeName).label || nodeName;

            // Clean keys for code lookup
            let key = nodeName.replace(/"/g, '');
            let sourceCode = codeMap.get(key);
            let calls = callsMap.get(key);

            // Generate ID
            const id = `node-${normalizeId(nodeName)}-${index}`;
            nodeMap.set(nodeName, id);

            const parent = graph.parent(nodeName);
            let parentId = undefined;
            let isInterface = false;
            if (parent && nodeMap.has(parent)) {
                parentId = nodeMap.get(parent);
                isInterface = clusterIsInterfaceMap.get(parent) || false;
            }

            nodes.push({
                id,
                position: { x: 0, y: 0 },
                data: { label, code: sourceCode, calls, isInterface },
                type: 'function',
                parentNode: parentId,
                extent: 'parent',
            });
        });

        const graphEdges = graph.edges() as { v: string, w: string }[];
        graphEdges.forEach((edge: { v: string, w: string }, index: number) => {
            const sourceId = nodeMap.get(edge.v);
            const targetId = nodeMap.get(edge.w);

            if (sourceId && targetId) {
                edges.push({
                    id: `edge-${index}`,
                    source: sourceId,
                    target: targetId,
                    animated: true,
                    type: 'smoothstep'
                });
            }
        });

        // Build contract metadata for the client
        const contracts = Array.from(clusters).map(clusterName => {
            const label = clusterLabelMap.get(clusterName) || clusterName;
            const isInterface = clusterIsInterfaceMap.get(clusterName) || false;
            const functionCount = nodes.filter(n => n.type === 'function' && n.parentNode === normalizeId(clusterName)).length;
            return { name: label, isInterface, functionCount };
        });

        // Clean up temp dir
        await fs.rm(tmpDir, { recursive: true, force: true });

        return NextResponse.json({ nodes, edges, contracts });

    } catch (error: any) {
        console.error('Error in /api/parse:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
