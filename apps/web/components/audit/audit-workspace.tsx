'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useRef, useState } from 'react';
import { FileCode2, Loader2, Upload, WandSparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const STARTER = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Vault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] -= amount; // state update AFTER external call — reentrancy!
    }
}`;

type FileEntry = { name: string; source: string };

export function AuditWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('Vault audit');
  const [uploadedFiles, setUploadedFiles] = useState<FileEntry[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [pastedSource, setPastedSource] = useState(STARTER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const useUpload = uploadedFiles.length > 0;
  const editorValue = useUpload ? (uploadedFiles[activeTab]?.source ?? '') : pastedSource;

  async function readFiles(fileList: File[]) {
    const sol = fileList.filter((f) => f.name.endsWith('.sol'));
    if (!sol.length) {
      setError('Select .sol files only.');
      return;
    }
    const entries: FileEntry[] = await Promise.all(
      sol.map(async (f) => ({ name: f.name, source: await f.text() }))
    );
    setUploadedFiles(entries);
    setActiveTab(0);
    setError('');
    if (!title || title === 'Vault audit') setTitle(sol[0].name.replace('.sol', '') + ' audit');
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) readFiles(Array.from(event.target.files));
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    readFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    const next = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(next);
    setActiveTab(Math.min(activeTab, Math.max(0, next.length - 1)));
  }

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (useUpload) {
        setUploadedFiles((prev) =>
          prev.map((f, i) => (i === activeTab ? { ...f, source: value ?? '' } : f))
        );
      } else {
        setPastedSource(value ?? '');
      }
    },
    [useUpload, activeTab]
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      let audit;
      if (useUpload) {
        const form = new FormData();
        form.set('title', title);
        for (const f of uploadedFiles) {
          const blob = new Blob([f.source], { type: 'text/plain' });
          form.append('files', blob, f.name);
        }
        audit = await api.uploadAudit(form);
      } else {
        const fileName = `${title.replace(/\s+/g, '-') || 'Contract'}.sol`;
        audit = await api.createAudit({ title, contracts: [{ fileName, source: pastedSource }] });
      }
      router.push(`/audit/${audit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit creation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* ── Left panel ── */}
      <Card className="flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold">New audit</h1>
          <p className="mt-1 text-xs text-muted">Upload .sol files or paste code in the editor.</p>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Audit title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My contract audit"
            required
          />
        </div>

        {/* Drop zone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">
            Solidity files
          </label>
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition ${
              dragOver ? 'border-primary bg-primary/10' : 'border-border bg-slate-950/50 hover:border-primary/50 hover:bg-slate-950/70'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-2 h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Drop or click to select</span>
            <span className="mt-0.5 text-xs text-muted">.sol files, multiple supported</span>
            <input ref={inputRef} className="hidden" type="file" accept=".sol" multiple onChange={handleFileInput} />
          </div>
        </div>

        {/* Uploaded file list */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Loaded files</p>
            {uploadedFiles.map((f, i) => (
              <div
                key={f.name}
                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                  i === activeTab ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-slate-950/50 hover:border-border/80'
                }`}
                onClick={() => setActiveTab(i)}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{f.name}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="ml-2 shrink-0 rounded p-0.5 text-muted hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <Button type="submit" className="mt-auto w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          {loading ? 'Starting audit…' : 'Run AI Audit'}
        </Button>
      </Card>

      {/* ── Editor panel ── */}
      <Card className="flex min-h-[680px] flex-col p-0">
        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {useUpload ? (
            uploadedFiles.map((f, i) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs transition ${
                  i === activeTab ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'
                }`}
              >
                <FileCode2 className="h-3 w-3" />
                {f.name}
              </button>
            ))
          ) : (
            <span className="px-3 py-1.5 text-xs text-muted">
              <FileCode2 className="mr-1.5 inline h-3 w-3" />
              Vault.sol — paste or edit below
            </span>
          )}
        </div>

        {/* Monaco */}
        <div className="flex-1">
          <MonacoEditor
            height="100%"
            language="sol"
            theme="vs-dark"
            value={editorValue}
            onChange={handleEditorChange}
            beforeMount={(monaco) => {
              if (!monaco.languages.getLanguages().some((l) => l.id === 'sol')) {
                monaco.languages.register({ id: 'sol' });
                monaco.languages.setMonarchTokensProvider('sol', {
                  keywords: ['pragma', 'solidity', 'contract', 'interface', 'library', 'function', 'modifier', 'event', 'constructor',
                    'mapping', 'address', 'uint256', 'uint', 'int256', 'int', 'bool', 'string', 'bytes', 'bytes32',
                    'public', 'private', 'internal', 'external', 'pure', 'view', 'payable', 'virtual', 'override',
                    'memory', 'storage', 'calldata', 'returns', 'return', 'if', 'else', 'for', 'while', 'do', 'break',
                    'continue', 'emit', 'new', 'delete', 'require', 'revert', 'assert', 'import', 'using', 'is',
                    'struct', 'enum', 'error', 'immutable', 'constant', 'indexed', 'anonymous', 'try', 'catch'],
                  tokenizer: {
                    root: [
                      [/\/\/.*$/, 'comment'],
                      [/\/\*/, 'comment', '@comment'],
                      [/"([^"\\]|\\.)*$/, 'string.invalid'],
                      [/"/, 'string', '@string'],
                      [/\b(0x[0-9a-fA-F]+|\d+)\b/, 'number'],
                      [/[{}[\]();,.]/, 'delimiter'],
                      [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
                    ],
                    comment: [[/[^/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[/*]/, 'comment']],
                    string: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']],
                  },
                });
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 22,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              fontFamily: '"Fira Code", "JetBrains Mono", monospace',
              fontLigatures: true,
            }}
          />
        </div>
      </Card>
    </form>
  );
}
