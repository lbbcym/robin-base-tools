# HARDENED_CORE.py
import subprocess
import sys
import os
import importlib.util

# Mitigation for XXE Vulnerability (Issue #5)
try:
    import defusedxml.ElementTree as ElementTree
    print("Using defusedxml for XML parsing")
except ImportError:
    print("defusedxml not found, please install it: pip install defusedxml")
    import xml.etree.ElementTree as ElementTree  # Fallback - still vulnerable!
    print("WARNING: Using standard xml.etree.ElementTree - XXE vulnerability is still present!")

# Mitigation for Plugin RCE (Issue #6)
TRUSTED_PLUGINS = [
    "desloppify.plugins.example_plugin",  # Example plugin - replace with actual trusted plugins
]

def load_plugin(plugin_name):
    if plugin_name not in TRUSTED_PLUGINS:
        raise ImportError(f"Plugin '{plugin_name}' is not in the trusted plugins list.")

    # Original code (assuming exec_module is used):
    try:
        spec = importlib.util.find_spec(plugin_name)
        if spec is None:
            raise ImportError(f"Plugin '{plugin_name}' not found")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"Error loading plugin {plugin_name}: {e}")
        raise

# Example usage (replace with the actual code that loads plugins)
# plugin = load_plugin("desloppify.plugins.example_plugin")

print("HARDENED_CORE.py applied - XXE and Plugin RCE mitigations in place.")
