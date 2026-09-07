# Patches

Documentation for Quantum patches applied on top of VS Code.

---

## fix-policies

**Replace `@vscode/policy-watcher` with `@vscodium/policy-watcher`**

VS Code uses `@vscode/policy-watcher` to enforce Group Policy Objects (GPOs) on
Windows. That package reads from:

```
HKLM\SOFTWARE\Policies\Microsoft\<productName>
```

Quantum forks this into `@vscodium/policy-watcher`, which takes a separate
`vendorName` argument. The `createWatcher()` call becomes:

```ts
createWatcher('Quantum', this.productName, ...)
```

Because Quantum sets `product.nameLong = 'Quantum'` (via `prepare_vscode.sh`),
`this.productName` resolves to `'Quantum'` at runtime. Therefore, the final
Windows registry key that Quantum reads policies from is:

```
HKLM\SOFTWARE\Policies\Quantum\Quantum\<PolicyName>
```

(or `HKCU\SOFTWARE\Policies\Quantum\Quantum\<PolicyName>` for per-user policies)

This differs from VS Code's path (`Microsoft\VSCode`) and is the root cause of
[issue #2714](https://github.com/Suryanshu-Nabheet/Quantum/issues/2714) where users mirror
VS Code's registry structure and find their GPOs ignored. Enterprise admins must
use the Quantum-specific registry path.

### References

- [Quantum issue #2714](https://github.com/Suryanshu-Nabheet/Quantum/issues/2714)
- [Quantum/policy-watcher — RegistryPolicy.hh](https://github.com/Quantum/policy-watcher/blob/main/src/windows/RegistryPolicy.hh)
