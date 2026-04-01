{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = fn: nixpkgs.lib.genAttrs systems (system: fn {
        pkgs = import nixpkgs { inherit system; };
      });

      remote = "root@nemesis.london";
      remotePath = "/var/www/nemesis";
      standardInterpreter = "/lib64/ld-linux-x86-64.so.2";
    in {
      devShells = forAllSystems ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [ bun patchelf ];
        };
      });

      apps = forAllSystems ({ pkgs }: {

        dev = {
          type = "app";
          program = toString (pkgs.writeShellScript "nemesis-dev" ''
            ${pkgs.bun}/bin/bun install --frozen-lockfile >/dev/null 2>&1 || ${pkgs.bun}/bin/bun install
            ${pkgs.bun}/bin/bun --hot serve.dev.ts
          '');
        };

        build = {
          type = "app";
          program = toString (pkgs.writeShellScript "nemesis-build" ''
            set -e
            ${pkgs.bun}/bin/bun install --frozen-lockfile >/dev/null 2>&1 || ${pkgs.bun}/bin/bun install
            START=$(date +%s.%N)

            mkdir -p dist
            ${pkgs.bun}/bin/bun build ./index.ts --outfile dist/app.js --minify --target=browser 2>/dev/null
            ${pkgs.bun}/bin/bun build ./serve.prod.ts --compile --minify --target=bun-linux-x64 --outfile=nemesis-app 2>/dev/null
            ${pkgs.patchelf}/bin/patchelf --set-interpreter ${standardInterpreter} nemesis-app

            INTERP=$(${pkgs.patchelf}/bin/patchelf --print-interpreter nemesis-app)
            if [[ "$INTERP" != "${standardInterpreter}" ]]; then
              echo "build failed: interpreter patch unsuccessful"
              exit 1
            fi

            END=$(date +%s.%N)
            TIME=$(echo "$END - $START" | ${pkgs.bc}/bin/bc)

            echo ""
            echo "NEMESIS"
            echo "binary    $(du -h nemesis-app | cut -f1)"
            echo "bundle    $(du -h dist/app.js | cut -f1)"
            echo "time      ''${TIME}s"
          '');
        };

        ship = {
          type = "app";
          program = toString (pkgs.writeShellScript "nemesis-ship" ''
            set -e
            ${pkgs.bun}/bin/bun install --frozen-lockfile >/dev/null 2>&1 || ${pkgs.bun}/bin/bun install
            BUILD_START=$(date +%s.%N)

            mkdir -p dist
            ${pkgs.bun}/bin/bun build ./index.ts --outfile dist/app.js --minify --target=browser 2>/dev/null
            ${pkgs.bun}/bin/bun build ./serve.prod.ts --compile --minify --target=bun-linux-x64 --outfile=nemesis-app 2>/dev/null
            ${pkgs.patchelf}/bin/patchelf --set-interpreter ${standardInterpreter} nemesis-app

            INTERP=$(${pkgs.patchelf}/bin/patchelf --print-interpreter nemesis-app)
            if [[ "$INTERP" != "${standardInterpreter}" ]]; then
              echo "ship aborted: interpreter patch unsuccessful"
              exit 1
            fi

            BUILD_END=$(date +%s.%N)
            DEPLOY_START=$(date +%s.%N)

            ${pkgs.rsync}/bin/rsync -az nemesis-app ${remote}:${remotePath}/ 2>/dev/null
            ${pkgs.openssh}/bin/ssh ${remote} 'systemctl restart nemesis' 2>/dev/null

            DEPLOY_END=$(date +%s.%N)

            BUILD_TIME=$(echo "$BUILD_END - $BUILD_START" | ${pkgs.bc}/bin/bc)
            DEPLOY_TIME=$(echo "$DEPLOY_END - $DEPLOY_START" | ${pkgs.bc}/bin/bc)
            TOTAL_TIME=$(echo "$DEPLOY_END - $BUILD_START" | ${pkgs.bc}/bin/bc)

            echo ""
            echo "NEMESIS"
            echo "binary    $(du -h nemesis-app | cut -f1)"
            echo "bundle    $(du -h dist/app.js | cut -f1)"
            echo "build     ''${BUILD_TIME}s"
            echo "deploy    ''${DEPLOY_TIME}s"
            echo "total     ''${TOTAL_TIME}s"
            echo "live      https://nemesis.london"
          '');
        };
      });
    };
}
