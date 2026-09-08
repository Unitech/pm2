/**
 * alias.js - terminfo/cap aliases for blessed.
 * https://github.com/chjj/blessed
 * Taken from terminfo(5) man page.
 */

/* jshint maxlen: 300 */
// jscs:disable maximumLineLength
// jscs:disable

var alias = exports;

// These are the boolean capabilities:
alias.bools = {
  //         Variable                                      Cap-                               TCap                                  Description
  //         Booleans                                      name                               Code
  'auto_left_margin':                                      ['bw',                                 'bw'], //                                cub1 wraps from col‐ umn 0 to last column
  'auto_right_margin':                                     ['am',                                 'am'], //                                terminal has auto‐ matic margins
  'back_color_erase':                                      ['bce',                                'ut'], //                                screen erased with background color
  'can_change':                                            ['ccc',                                'cc'], //                                terminal can re- define existing col‐ ors
  'ceol_standout_glitch':                                  ['xhp',                                'xs'], //                                standout not erased by overwriting (hp)
  'col_addr_glitch':                                       ['xhpa',                               'YA'], //                                only positive motion for hpa/mhpa caps
  'cpi_changes_res':                                       ['cpix',                               'YF'], //                                changing character pitch changes reso‐ lution
  'cr_cancels_micro_mode':                                 ['crxm',                               'YB'], //                                using cr turns off micro mode
  'dest_tabs_magic_smso':                                  ['xt',                                 'xt'], //                                tabs destructive, magic so char (t1061)
  'eat_newline_glitch':                                    ['xenl',                               'xn'], //                                newline ignored after 80 cols (con‐ cept)
  'erase_overstrike':                                      ['eo',                                 'eo'], //                                can erase over‐ strikes with a blank
  'generic_type':                                          ['gn',                                 'gn'], //                                generic line type
  'hard_copy':                                             ['hc',                                 'hc'], //                                hardcopy terminal
  'hard_cursor':                                           ['chts',                               'HC'], //                                cursor is hard to see
  'has_meta_key':                                          ['km',                                 'km'], //                                Has a meta key (i.e., sets 8th-bit)
  'has_print_wheel':                                       ['daisy',                              'YC'], //                                printer needs opera‐ tor to change char‐ acter set
  'has_status_line':                                       ['hs',                                 'hs'], //                                has extra status line
  'hue_lightness_saturation':                              ['hls',                                'hl'], //                                terminal uses only HLS color notation (Tektronix)
  'insert_null_glitch':                                    ['in',                                 'in'], //                                insert mode distin‐ guishes nulls
  'lpi_changes_res':                                       ['lpix',                               'YG'], //                                changing line pitch changes resolution
  'memory_above':                                          ['da',                                 'da'], //                                display may be retained above the screen
  'memory_below':                                          ['db',                                 'db'], //                                display may be retained below the screen
  'move_insert_mode':                                      ['mir',                                'mi'], //                                safe to move while in insert mode
  'move_standout_mode':                                    ['msgr',                               'ms'], //                                safe to move while in standout mode
  'needs_xon_xoff':                                        ['nxon',                               'nx'], //                                padding will not work, xon/xoff required
  'no_esc_ctlc':                                           ['xsb',                                'xb'], //                                beehive (f1=escape, f2=ctrl C)
  'no_pad_char':                                           ['npc',                                'NP'], //                                pad character does not exist
  'non_dest_scroll_region':                                ['ndscr',                              'ND'], //                                scrolling region is non-destructive
  'non_rev_rmcup':                                         ['nrrmc',                              'NR'], //                                smcup does not reverse rmcup
  'over_strike':                                           ['os',                                 'os'], //                                terminal can over‐ strike
  'prtr_silent':                                           ['mc5i',                               '5i'], //                                printer will not echo on screen
  'row_addr_glitch':                                       ['xvpa',                               'YD'], //                                only positive motion for vpa/mvpa caps
  'semi_auto_right_margin':                                ['sam',                                'YE'], //                                printing in last column causes cr
  'status_line_esc_ok':                                    ['eslok',                              'es'], //                                escape can be used on the status line
  'tilde_glitch':                                          ['hz',                                 'hz'], //                                cannot print ~'s (hazeltine)
  'transparent_underline':                                 ['ul',                                 'ul'], //                                underline character overstrikes
  'xon_xoff':                                              ['xon',                                'xo']  //                                terminal uses xon/xoff handshaking
};

// These are the numeric capabilities:
alias.numbers = {
  //         Variable                                      Cap-                               TCap                                  Description
  //          Numeric                                      name                               Code
  'columns':                                               ['cols',                               'co'], //                                number of columns in a line
  'init_tabs':                                             ['it',                                 'it'], //                                tabs initially every # spaces
  'label_height':                                          ['lh',                                 'lh'], //                                rows in each label
  'label_width':                                           ['lw',                                 'lw'], //                                columns in each label
  'lines':                                                 ['lines',                              'li'], //                                number of lines on screen or page
  'lines_of_memory':                                       ['lm',                                 'lm'], //                                lines of memory if > line. 0 means varies
  'magic_cookie_glitch':                                   ['xmc',                                'sg'], //                                number of blank characters left by smso or rmso
  'max_attributes':                                        ['ma',                                 'ma'], //                                maximum combined attributes terminal can handle
  'max_colors':                                            ['colors',                             'Co'], //                                maximum number of colors on screen
  'max_pairs':                                             ['pairs',                              'pa'], //                                maximum number of color-pairs on the screen
  'maximum_windows':                                       ['wnum',                               'MW'], //                                maximum number of defineable windows
  'no_color_video':                                        ['ncv',                                'NC'], //                                video attributes that cannot be used with colors
  'num_labels':                                            ['nlab',                               'Nl'], //                                number of labels on screen
  'padding_baud_rate':                                     ['pb',                                 'pb'], //                                lowest baud rate where padding needed
  'virtual_terminal':                                      ['vt',                                 'vt'], //                                virtual terminal number (CB/unix)
  'width_status_line':                                     ['wsl',                                'ws'], //                                number of columns in status line

  // The  following  numeric  capabilities  are present in the SVr4.0 term structure, but are not yet documented in the man page.  They came in with
  // SVr4's printer support.


  //         Variable                                      Cap-                               TCap                                  Description
  //          Numeric                                      name                               Code
  'bit_image_entwining':                                   ['bitwin',                             'Yo'], //                                number of passes for each bit-image row
  'bit_image_type':                                        ['bitype',                             'Yp'], //                                type of bit-image device
  'buffer_capacity':                                       ['bufsz',                              'Ya'], //                                numbers of bytes buffered before printing
  'buttons':                                               ['btns',                               'BT'], //                                number of buttons on mouse
  'dot_horz_spacing':                                      ['spinh',                              'Yc'], //                                spacing of dots hor‐ izontally in dots per inch
  'dot_vert_spacing':                                      ['spinv',                              'Yb'], //                                spacing of pins ver‐ tically in pins per inch
  'max_micro_address':                                     ['maddr',                              'Yd'], //                                maximum value in micro_..._address
  'max_micro_jump':                                        ['mjump',                              'Ye'], //                                maximum value in parm_..._micro
  'micro_col_size':                                        ['mcs',                                'Yf'], //                                character step size when in micro mode
  'micro_line_size':                                       ['mls',                                'Yg'], //                                line step size when in micro mode
  'number_of_pins':                                        ['npins',                              'Yh'], //                                numbers of pins in print-head
  'output_res_char':                                       ['orc',                                'Yi'], //                                horizontal resolu‐ tion in units per line
  'output_res_horz_inch':                                  ['orhi',                               'Yk'], //                                horizontal resolu‐ tion in units per inch
  'output_res_line':                                       ['orl',                                'Yj'], //                                vertical resolution in units per line
  'output_res_vert_inch':                                  ['orvi',                               'Yl'], //                                vertical resolution in units per inch
  'print_rate':                                            ['cps',                                'Ym'], //                                print rate in char‐ acters per second
  'wide_char_size':                                        ['widcs',                              'Yn']  //                                character step size when in double wide mode
};

// These are the string capabilities:
alias.strings = {
  //         Variable                                    Cap-                             TCap                                   Description
  //          String                                     name                             Code
  'acs_chars':                                           ['acsc',                             'ac'], //                              graphics charset pairs, based on vt100
  'back_tab':                                            ['cbt',                              'bt'], //                              back tab (P)
  'bell':                                                ['bel',                              'bl'], //                              audible signal (bell) (P)
  'carriage_return':                                     ['cr',                               'cr'], //                              carriage return (P*) (P*)
  'change_char_pitch':                                   ['cpi',                              'ZA'], //                              Change number of characters per inch to #1
  'change_line_pitch':                                   ['lpi',                              'ZB'], //                              Change number of lines per inch to #1
  'change_res_horz':                                     ['chr',                              'ZC'], //                              Change horizontal resolution to #1
  'change_res_vert':                                     ['cvr',                              'ZD'], //                              Change vertical res‐ olution to #1
  'change_scroll_region':                                ['csr',                              'cs'], //                              change region to line #1 to line #2 (P)
  'char_padding':                                        ['rmp',                              'rP'], //                              like ip but when in insert mode
  'clear_all_tabs':                                      ['tbc',                              'ct'], //                              clear all tab stops (P)
  'clear_margins':                                       ['mgc',                              'MC'], //                              clear right and left soft margins
  'clear_screen':                                        ['clear',                            'cl'], //                              clear screen and home cursor (P*)
  'clr_bol':                                             ['el1',                              'cb'], //                              Clear to beginning of line
  'clr_eol':                                             ['el',                               'ce'], //                              clear to end of line (P)
  'clr_eos':                                             ['ed',                               'cd'], //                              clear to end of screen (P*)
  'column_address':                                      ['hpa',                              'ch'], //                              horizontal position #1, absolute (P)
  'command_character':                                   ['cmdch',                            'CC'], //                              terminal settable cmd character in prototype !?
  'create_window':                                       ['cwin',                             'CW'], //                              define a window #1 from #2,#3 to #4,#5
  'cursor_address':                                      ['cup',                              'cm'], //                              move to row #1 col‐ umns #2
  'cursor_down':                                         ['cud1',                             'do'], //                              down one line
  'cursor_home':                                         ['home',                             'ho'], //                              home cursor (if no cup)
  'cursor_invisible':                                    ['civis',                            'vi'], //                              make cursor invisi‐ ble
  'cursor_left':                                         ['cub1',                             'le'], //                              move left one space
  'cursor_mem_address':                                  ['mrcup',                            'CM'], //                              memory relative cur‐ sor addressing, move to row #1 columns #2
  'cursor_normal':                                       ['cnorm',                            've'], //                              make cursor appear normal (undo civis/cvvis)
  'cursor_right':                                        ['cuf1',                             'nd'], //                              non-destructive space (move right one space)
  'cursor_to_ll':                                        ['ll',                               'll'], //                              last line, first column (if no cup)
  'cursor_up':                                           ['cuu1',                             'up'], //                              up one line
  'cursor_visible':                                      ['cvvis',                            'vs'], //                              make cursor very visible
  'define_char':                                         ['defc',                             'ZE'], //                              Define a character #1, #2 dots wide, descender #3
  'delete_character':                                    ['dch1',                             'dc'], //                              delete character (P*)
  'delete_line':                                         ['dl1',                              'dl'], //                              delete line (P*)
  'dial_phone':                                          ['dial',                             'DI'], //                              dial number #1
  'dis_status_line':                                     ['dsl',                              'ds'], //                              disable status line
  'display_clock':                                       ['dclk',                             'DK'], //                              display clock
  'down_half_line':                                      ['hd',                               'hd'], //                              half a line down
  'ena_acs':                                             ['enacs',                            'eA'], //                              enable alternate char set
  'enter_alt_charset_mode':                              ['smacs',                            'as'], //                              start alternate character set (P)
  'enter_am_mode':                                       ['smam',                             'SA'], //                              turn on automatic margins
  'enter_blink_mode':                                    ['blink',                            'mb'], //                              turn on blinking
  'enter_bold_mode':                                     ['bold',                             'md'], //                              turn on bold (extra bright) mode
  'enter_ca_mode':                                       ['smcup',                            'ti'], //                              string to start pro‐ grams using cup
  'enter_delete_mode':                                   ['smdc',                             'dm'], //                              enter delete mode
  'enter_dim_mode':                                      ['dim',                              'mh'], //                              turn on half-bright mode
  'enter_doublewide_mode':                               ['swidm',                            'ZF'], //                              Enter double-wide mode
  'enter_draft_quality':                                 ['sdrfq',                            'ZG'], //                              Enter draft-quality mode
  'enter_insert_mode':                                   ['smir',                             'im'], //                              enter insert mode
  'enter_italics_mode':                                  ['sitm',                             'ZH'], //                              Enter italic mode
  'enter_leftward_mode':                                 ['slm',                              'ZI'], //                              Start leftward car‐ riage motion
  'enter_micro_mode':                                    ['smicm',                            'ZJ'], //                              Start micro-motion mode
  'enter_near_letter_quality':                           ['snlq',                             'ZK'], //                              Enter NLQ mode
  'enter_normal_quality':                                ['snrmq',                            'ZL'], //                              Enter normal-quality mode
  'enter_protected_mode':                                ['prot',                             'mp'], //                              turn on protected mode
  'enter_reverse_mode':                                  ['rev',                              'mr'], //                              turn on reverse video mode
  'enter_secure_mode':                                   ['invis',                            'mk'], //                              turn on blank mode (characters invisi‐ ble)
  'enter_shadow_mode':                                   ['sshm',                             'ZM'], //                              Enter shadow-print mode
  'enter_standout_mode':                                 ['smso',                             'so'], //                              begin standout mode
  'enter_subscript_mode':                                ['ssubm',                            'ZN'], //                              Enter subscript mode
  'enter_superscript_mode':                              ['ssupm',                            'ZO'], //                              Enter superscript mode
  'enter_underline_mode':                                ['smul',                             'us'], //                              begin underline mode
  'enter_upward_mode':                                   ['sum',                              'ZP'], //                              Start upward car‐ riage motion
  'enter_xon_mode':                                      ['smxon',                            'SX'], //                              turn on xon/xoff handshaking
  'erase_chars':                                         ['ech',                              'ec'], //                              erase #1 characters (P)
  'exit_alt_charset_mode':                               ['rmacs',                            'ae'], //                              end alternate char‐ acter set (P)
  'exit_am_mode':                                        ['rmam',                             'RA'], //                              turn off automatic margins
  'exit_attribute_mode':                                 ['sgr0',                             'me'], //                              turn off all attributes
  'exit_ca_mode':                                        ['rmcup',                            'te'], //                              strings to end pro‐ grams using cup
  'exit_delete_mode':                                    ['rmdc',                             'ed'], //                              end delete mode
  'exit_doublewide_mode':                                ['rwidm',                            'ZQ'], //                              End double-wide mode
  'exit_insert_mode':                                    ['rmir',                             'ei'], //                              exit insert mode
  'exit_italics_mode':                                   ['ritm',                             'ZR'], //                              End italic mode
  'exit_leftward_mode':                                  ['rlm',                              'ZS'], //                              End left-motion mode


  'exit_micro_mode':                                     ['rmicm',                            'ZT'], //                              End micro-motion mode
  'exit_shadow_mode':                                    ['rshm',                             'ZU'], //                              End shadow-print mode
  'exit_standout_mode':                                  ['rmso',                             'se'], //                              exit standout mode
  'exit_subscript_mode':                                 ['rsubm',                            'ZV'], //                              End subscript mode
  'exit_superscript_mode':                               ['rsupm',                            'ZW'], //                              End superscript mode
  'exit_underline_mode':                                 ['rmul',                             'ue'], //                              exit underline mode
  'exit_upward_mode':                                    ['rum',                              'ZX'], //                              End reverse charac‐ ter motion
  'exit_xon_mode':                                       ['rmxon',                            'RX'], //                              turn off xon/xoff handshaking
  'fixed_pause':                                         ['pause',                            'PA'], //                              pause for 2-3 sec‐ onds
  'flash_hook':                                          ['hook',                             'fh'], //                              flash switch hook
  'flash_screen':                                        ['flash',                            'vb'], //                              visible bell (may not move cursor)
  'form_feed':                                           ['ff',                               'ff'], //                              hardcopy terminal page eject (P*)
  'from_status_line':                                    ['fsl',                              'fs'], //                              return from status line
  'goto_window':                                         ['wingo',                            'WG'], //                              go to window #1
  'hangup':                                              ['hup',                              'HU'], //                              hang-up phone
  'init_1string':                                        ['is1',                              'i1'], //                              initialization string
  'init_2string':                                        ['is2',                              'is'], //                              initialization string
  'init_3string':                                        ['is3',                              'i3'], //                              initialization string
  'init_file':                                           ['if',                               'if'], //                              name of initializa‐ tion file
  'init_prog':                                           ['iprog',                            'iP'], //                              path name of program for initialization
  'initialize_color':                                    ['initc',                            'Ic'], //                              initialize color #1 to (#2,#3,#4)
  'initialize_pair':                                     ['initp',                            'Ip'], //                              Initialize color pair #1 to fg=(#2,#3,#4), bg=(#5,#6,#7)
  'insert_character':                                    ['ich1',                             'ic'], //                              insert character (P)
  'insert_line':                                         ['il1',                              'al'], //                              insert line (P*)
  'insert_padding':                                      ['ip',                               'ip'], //                              insert padding after inserted character
  'key_a1':                                              ['ka1',                              'K1'], //                              upper left of keypad
  'key_a3':                                              ['ka3',                              'K3'], //                              upper right of key‐ pad
  'key_b2':                                              ['kb2',                              'K2'], //                              center of keypad
  'key_backspace':                                       ['kbs',                              'kb'], //                              backspace key
  'key_beg':                                             ['kbeg',                             '@1'], //                              begin key
  'key_btab':                                            ['kcbt',                             'kB'], //                              back-tab key
  'key_c1':                                              ['kc1',                              'K4'], //                              lower left of keypad
  'key_c3':                                              ['kc3',                              'K5'], //                              lower right of key‐ pad
  'key_cancel':                                          ['kcan',                             '@2'], //                              cancel key
  'key_catab':                                           ['ktbc',                             'ka'], //                              clear-all-tabs key
  'key_clear':                                           ['kclr',                             'kC'], //                              clear-screen or erase key
  'key_close':                                           ['kclo',                             '@3'], //                              close key
  'key_command':                                         ['kcmd',                             '@4'], //                              command key
  'key_copy':                                            ['kcpy',                             '@5'], //                              copy key
  'key_create':                                          ['kcrt',                             '@6'], //                              create key
  'key_ctab':                                            ['kctab',                            'kt'], //                              clear-tab key
  'key_dc':                                              ['kdch1',                            'kD'], //                              delete-character key
  'key_dl':                                              ['kdl1',                             'kL'], //                              delete-line key
  'key_down':                                            ['kcud1',                            'kd'], //                              down-arrow key

  'key_eic':                                             ['krmir',                            'kM'], //                              sent by rmir or smir in insert mode
  'key_end':                                             ['kend',                             '@7'], //                              end key
  'key_enter':                                           ['kent',                             '@8'], //                              enter/send key
  'key_eol':                                             ['kel',                              'kE'], //                              clear-to-end-of-line key
  'key_eos':                                             ['ked',                              'kS'], //                              clear-to-end-of- screen key
  'key_exit':                                            ['kext',                             '@9'], //                              exit key
  'key_f0':                                              ['kf0',                              'k0'], //                              F0 function key
  'key_f1':                                              ['kf1',                              'k1'], //                              F1 function key
  'key_f10':                                             ['kf10',                             'k;'], //                              F10 function key
  'key_f11':                                             ['kf11',                             'F1'], //                              F11 function key
  'key_f12':                                             ['kf12',                             'F2'], //                              F12 function key
  'key_f13':                                             ['kf13',                             'F3'], //                              F13 function key
  'key_f14':                                             ['kf14',                             'F4'], //                              F14 function key
  'key_f15':                                             ['kf15',                             'F5'], //                              F15 function key
  'key_f16':                                             ['kf16',                             'F6'], //                              F16 function key
  'key_f17':                                             ['kf17',                             'F7'], //                              F17 function key
  'key_f18':                                             ['kf18',                             'F8'], //                              F18 function key
  'key_f19':                                             ['kf19',                             'F9'], //                              F19 function key
  'key_f2':                                              ['kf2',                              'k2'], //                              F2 function key
  'key_f20':                                             ['kf20',                             'FA'], //                              F20 function key
  'key_f21':                                             ['kf21',                             'FB'], //                              F21 function key
  'key_f22':                                             ['kf22',                             'FC'], //                              F22 function key
  'key_f23':                                             ['kf23',                             'FD'], //                              F23 function key
  'key_f24':                                             ['kf24',                             'FE'], //                              F24 function key
  'key_f25':                                             ['kf25',                             'FF'], //                              F25 function key
  'key_f26':                                             ['kf26',                             'FG'], //                              F26 function key
  'key_f27':                                             ['kf27',                             'FH'], //                              F27 function key
  'key_f28':                                             ['kf28',                             'FI'], //                              F28 function key
  'key_f29':                                             ['kf29',                             'FJ'], //                              F29 function key
  'key_f3':                                              ['kf3',                              'k3'], //                              F3 function key
  'key_f30':                                             ['kf30',                             'FK'], //                              F30 function key
  'key_f31':                                             ['kf31',                             'FL'], //                              F31 function key
  'key_f32':                                             ['kf32',                             'FM'], //                              F32 function key
  'key_f33':                                             ['kf33',                             'FN'], //                              F33 function key
  'key_f34':                                             ['kf34',                             'FO'], //                              F34 function key
  'key_f35':                                             ['kf35',                             'FP'], //                              F35 function key
  'key_f36':                                             ['kf36',                             'FQ'], //                              F36 function key
  'key_f37':                                             ['kf37',                             'FR'], //                              F37 function key
  'key_f38':                                             ['kf38',                             'FS'], //                              F38 function key
  'key_f39':                                             ['kf39',                             'FT'], //                              F39 function key
  'key_f4':                                              ['kf4',                              'k4'], //                              F4 function key
  'key_f40':                                             ['kf40',                             'FU'], //                              F40 function key
  'key_f41':                                             ['kf41',                             'FV'], //                              F41 function key
  'key_f42':                                             ['kf42',                             'FW'], //                              F42 function key
  'key_f43':                                             ['kf43',                             'FX'], //                              F43 function key
  'key_f44':                                             ['kf44',                             'FY'], //                              F44 function key
  'key_f45':                                             ['kf45',                             'FZ'], //                              F45 function key
  'key_f46':                                             ['kf46',                             'Fa'], //                              F46 function key
  'key_f47':                                             ['kf47',                             'Fb'], //                              F47 function key
  'key_f48':                                             ['kf48',                             'Fc'], //                              F48 function key
  'key_f49':                                             ['kf49',                             'Fd'], //                              F49 function key
  'key_f5':                                              ['kf5',                              'k5'], //                              F5 function key
  'key_f50':                                             ['kf50',                             'Fe'], //                              F50 function key
  'key_f51':                                             ['kf51',                             'Ff'], //                              F51 function key
  'key_f52':                                             ['kf52',                             'Fg'], //                              F52 function key
  'key_f53':                                             ['kf53',                             'Fh'], //                              F53 function key
  'key_f54':                                             ['kf54',                             'Fi'], //                              F54 function key
  'key_f55':                                             ['kf55',                             'Fj'], //                              F55 function key
  'key_f56':                                             ['kf56',                             'Fk'], //                              F56 function key
  'key_f57':                                             ['kf57',                             'Fl'], //                              F57 function key
  'key_f58':                                             ['kf58',                             'Fm'], //                              F58 function key
  'key_f59':                                             ['kf59',                             'Fn'], //                              F59 function key

  'key_f6':                                              ['kf6',                              'k6'], //                              F6 function key
  'key_f60':                                             ['kf60',                             'Fo'], //                              F60 function key
  'key_f61':                                             ['kf61',                             'Fp'], //                              F61 function key
  'key_f62':                                             ['kf62',                             'Fq'], //                              F62 function key
  'key_f63':                                             ['kf63',                             'Fr'], //                              F63 function key
  'key_f7':                                              ['kf7',                              'k7'], //                              F7 function key
  'key_f8':                                              ['kf8',                              'k8'], //                              F8 function key
  'key_f9':                                              ['kf9',                              'k9'], //                              F9 function key
  'key_find':                                            ['kfnd',                             '@0'], //                              find key
  'key_help':                                            ['khlp',                             '%1'], //                              help key
  'key_home':                                            ['khome',                            'kh'], //                              home key
  'key_ic':                                              ['kich1',                            'kI'], //                              insert-character key
  'key_il':                                              ['kil1',                             'kA'], //                              insert-line key
  'key_left':                                            ['kcub1',                            'kl'], //                              left-arrow key
  'key_ll':                                              ['kll',                              'kH'], //                              lower-left key (home down)
  'key_mark':                                            ['kmrk',                             '%2'], //                              mark key
  'key_message':                                         ['kmsg',                             '%3'], //                              message key
  'key_move':                                            ['kmov',                             '%4'], //                              move key
  'key_next':                                            ['knxt',                             '%5'], //                              next key
  'key_npage':                                           ['knp',                              'kN'], //                              next-page key
  'key_open':                                            ['kopn',                             '%6'], //                              open key
  'key_options':                                         ['kopt',                             '%7'], //                              options key
  'key_ppage':                                           ['kpp',                              'kP'], //                              previous-page key
  'key_previous':                                        ['kprv',                             '%8'], //                              previous key
  'key_print':                                           ['kprt',                             '%9'], //                              print key
  'key_redo':                                            ['krdo',                             '%0'], //                              redo key
  'key_reference':                                       ['kref',                             '&1'], //                              reference key
  'key_refresh':                                         ['krfr',                             '&2'], //                              refresh key
  'key_replace':                                         ['krpl',                             '&3'], //                              replace key
  'key_restart':                                         ['krst',                             '&4'], //                              restart key
  'key_resume':                                          ['kres',                             '&5'], //                              resume key
  'key_right':                                           ['kcuf1',                            'kr'], //                              right-arrow key
  'key_save':                                            ['ksav',                             '&6'], //                              save key
  'key_sbeg':                                            ['kBEG',                             '&9'], //                              shifted begin key
  'key_scancel':                                         ['kCAN',                             '&0'], //                              shifted cancel key
  'key_scommand':                                        ['kCMD',                             '*1'], //                              shifted command key
  'key_scopy':                                           ['kCPY',                             '*2'], //                              shifted copy key
  'key_screate':                                         ['kCRT',                             '*3'], //                              shifted create key
  'key_sdc':                                             ['kDC',                              '*4'], //                              shifted delete-char‐ acter key
  'key_sdl':                                             ['kDL',                              '*5'], //                              shifted delete-line key
  'key_select':                                          ['kslt',                             '*6'], //                              select key
  'key_send':                                            ['kEND',                             '*7'], //                              shifted end key
  'key_seol':                                            ['kEOL',                             '*8'], //                              shifted clear-to- end-of-line key
  'key_sexit':                                           ['kEXT',                             '*9'], //                              shifted exit key
  'key_sf':                                              ['kind',                             'kF'], //                              scroll-forward key
  'key_sfind':                                           ['kFND',                             '*0'], //                              shifted find key
  'key_shelp':                                           ['kHLP',                             '#1'], //                              shifted help key
  'key_shome':                                           ['kHOM',                             '#2'], //                              shifted home key
  'key_sic':                                             ['kIC',                              '#3'], //                              shifted insert-char‐ acter key
  'key_sleft':                                           ['kLFT',                             '#4'], //                              shifted left-arrow key
  'key_smessage':                                        ['kMSG',                             '%a'], //                              shifted message key
  'key_smove':                                           ['kMOV',                             '%b'], //                              shifted move key
  'key_snext':                                           ['kNXT',                             '%c'], //                              shifted next key
  'key_soptions':                                        ['kOPT',                             '%d'], //                              shifted options key
  'key_sprevious':                                       ['kPRV',                             '%e'], //                              shifted previous key
  'key_sprint':                                          ['kPRT',                             '%f'], //                              shifted print key
  'key_sr':                                              ['kri',                              'kR'], //                              scroll-backward key
  'key_sredo':                                           ['kRDO',                             '%g'], //                              shifted redo key
  'key_sreplace':                                        ['kRPL',                             '%h'], //                              shifted replace key

  'key_sright':                                          ['kRIT',                             '%i'], //                              shifted right-arrow key
  'key_srsume':                                          ['kRES',                             '%j'], //                              shifted resume key
  'key_ssave':                                           ['kSAV',                             '!1'], //                              shifted save key
  'key_ssuspend':                                        ['kSPD',                             '!2'], //                              shifted suspend key
  'key_stab':                                            ['khts',                             'kT'], //                              set-tab key
  'key_sundo':                                           ['kUND',                             '!3'], //                              shifted undo key
  'key_suspend':                                         ['kspd',                             '&7'], //                              suspend key
  'key_undo':                                            ['kund',                             '&8'], //                              undo key
  'key_up':                                              ['kcuu1',                            'ku'], //                              up-arrow key
  'keypad_local':                                        ['rmkx',                             'ke'], //                              leave 'key‐ board_transmit' mode
  'keypad_xmit':                                         ['smkx',                             'ks'], //                              enter 'key‐ board_transmit' mode
  'lab_f0':                                              ['lf0',                              'l0'], //                              label on function key f0 if not f0
  'lab_f1':                                              ['lf1',                              'l1'], //                              label on function key f1 if not f1
  'lab_f10':                                             ['lf10',                             'la'], //                              label on function key f10 if not f10
  'lab_f2':                                              ['lf2',                              'l2'], //                              label on function key f2 if not f2
  'lab_f3':                                              ['lf3',                              'l3'], //                              label on function key f3 if not f3
  'lab_f4':                                              ['lf4',                              'l4'], //                              label on function key f4 if not f4
  'lab_f5':                                              ['lf5',                              'l5'], //                              label on function key f5 if not f5
  'lab_f6':                                              ['lf6',                              'l6'], //                              label on function key f6 if not f6
  'lab_f7':                                              ['lf7',                              'l7'], //                              label on function key f7 if not f7
  'lab_f8':                                              ['lf8',                              'l8'], //                              label on function key f8 if not f8
  'lab_f9':                                              ['lf9',                              'l9'], //                              label on function key f9 if not f9
  'label_format':                                        ['fln',                              'Lf'], //                              label format
  'label_off':                                           ['rmln',                             'LF'], //                              turn off soft labels
  'label_on':                                            ['smln',                             'LO'], //                              turn on soft labels
  'meta_off':                                            ['rmm',                              'mo'], //                              turn off meta mode
  'meta_on':                                             ['smm',                              'mm'], //                              turn on meta mode (8th-bit on)
  'micro_column_address':                                ['mhpa',                             'ZY'], //                              Like column_address in micro mode
  'micro_down':                                          ['mcud1',                            'ZZ'], //                              Like cursor_down in micro mode
  'micro_left':                                          ['mcub1',                            'Za'], //                              Like cursor_left in micro mode
  'micro_right':                                         ['mcuf1',                            'Zb'], //                              Like cursor_right in micro mode
  'micro_row_address':                                   ['mvpa',                             'Zc'], //                              Like row_address #1 in micro mode
  'micro_up':                                            ['mcuu1',                            'Zd'], //                              Like cursor_up in micro mode
  'newline':                                             ['nel',                              'nw'], //                              newline (behave like cr followed by lf)
  'order_of_pins':                                       ['porder',                           'Ze'], //                              Match software bits to print-head pins
  'orig_colors':                                         ['oc',                               'oc'], //                              Set all color pairs to the original ones
  'orig_pair':                                           ['op',                               'op'], //                              Set default pair to its original value
  'pad_char':                                            ['pad',                              'pc'], //                              padding char (instead of null)


  'parm_dch':                                            ['dch',                              'DC'], //                              delete #1 characters (P*)
  'parm_delete_line':                                    ['dl',                               'DL'], //                              delete #1 lines (P*)
  'parm_down_cursor':                                    ['cud',                              'DO'], //                              down #1 lines (P*)
  'parm_down_micro':                                     ['mcud',                             'Zf'], //                              Like parm_down_cur‐ sor in micro mode
  'parm_ich':                                            ['ich',                              'IC'], //                              insert #1 characters (P*)
  'parm_index':                                          ['indn',                             'SF'], //                              scroll forward #1 lines (P)
  'parm_insert_line':                                    ['il',                               'AL'], //                              insert #1 lines (P*)
  'parm_left_cursor':                                    ['cub',                              'LE'], //                              move #1 characters to the left (P)
  'parm_left_micro':                                     ['mcub',                             'Zg'], //                              Like parm_left_cur‐ sor in micro mode
  'parm_right_cursor':                                   ['cuf',                              'RI'], //                              move #1 characters to the right (P*)
  'parm_right_micro':                                    ['mcuf',                             'Zh'], //                              Like parm_right_cur‐ sor in micro mode
  'parm_rindex':                                         ['rin',                              'SR'], //                              scroll back #1 lines (P)
  'parm_up_cursor':                                      ['cuu',                              'UP'], //                              up #1 lines (P*)
  'parm_up_micro':                                       ['mcuu',                             'Zi'], //                              Like parm_up_cursor in micro mode
  'pkey_key':                                            ['pfkey',                            'pk'], //                              program function key #1 to type string #2
  'pkey_local':                                          ['pfloc',                            'pl'], //                              program function key #1 to execute string #2
  'pkey_xmit':                                           ['pfx',                              'px'], //                              program function key #1 to transmit string #2
  'plab_norm':                                           ['pln',                              'pn'], //                              program label #1 to show string #2
  'print_screen':                                        ['mc0',                              'ps'], //                              print contents of screen
  'prtr_non':                                            ['mc5p',                             'pO'], //                              turn on printer for #1 bytes
  'prtr_off':                                            ['mc4',                              'pf'], //                              turn off printer
  'prtr_on':                                             ['mc5',                              'po'], //                              turn on printer
  'pulse':                                               ['pulse',                            'PU'], //                              select pulse dialing
  'quick_dial':                                          ['qdial',                            'QD'], //                              dial number #1 with‐ out checking
  'remove_clock':                                        ['rmclk',                            'RC'], //                              remove clock
  'repeat_char':                                         ['rep',                              'rp'], //                              repeat char #1 #2 times (P*)
  'req_for_input':                                       ['rfi',                              'RF'], //                              send next input char (for ptys)
  'reset_1string':                                       ['rs1',                              'r1'], //                              reset string
  'reset_2string':                                       ['rs2',                              'r2'], //                              reset string
  'reset_3string':                                       ['rs3',                              'r3'], //                              reset string
  'reset_file':                                          ['rf',                               'rf'], //                              name of reset file
  'restore_cursor':                                      ['rc',                               'rc'], //                              restore cursor to position of last save_cursor
  'row_address':                                         ['vpa',                              'cv'], //                              vertical position #1 absolute (P)
  'save_cursor':                                         ['sc',                               'sc'], //                              save current cursor position (P)
  'scroll_forward':                                      ['ind',                              'sf'], //                              scroll text up (P)
  'scroll_reverse':                                      ['ri',                               'sr'], //                              scroll text down (P)
  'select_char_set':                                     ['scs',                              'Zj'], //                              Select character set, #1



  'set_attributes':                                      ['sgr',                              'sa'], //                              define video attributes #1-#9 (PG9)
  'set_background':                                      ['setb',                             'Sb'], //                              Set background color #1
  'set_bottom_margin':                                   ['smgb',                             'Zk'], //                              Set bottom margin at current line
  'set_bottom_margin_parm':                              ['smgbp',                            'Zl'], //                              Set bottom margin at line #1 or (if smgtp is not given) #2 lines from bottom
  'set_clock':                                           ['sclk',                             'SC'], //                              set clock, #1 hrs #2 mins #3 secs
  'set_color_pair':                                      ['scp',                              'sp'], //                              Set current color pair to #1
  'set_foreground':                                      ['setf',                             'Sf'], //                              Set foreground color #1
  'set_left_margin':                                     ['smgl',                             'ML'], //                              set left soft margin at current col‐ umn.  See smgl. (ML is not in BSD termcap).
  'set_left_margin_parm':                                ['smglp',                            'Zm'], //                              Set left (right) margin at column #1
  'set_right_margin':                                    ['smgr',                             'MR'], //                              set right soft margin at current column
  'set_right_margin_parm':                               ['smgrp',                            'Zn'], //                              Set right margin at column #1
  'set_tab':                                             ['hts',                              'st'], //                              set a tab in every row, current columns
  'set_top_margin':                                      ['smgt',                             'Zo'], //                              Set top margin at current line
  'set_top_margin_parm':                                 ['smgtp',                            'Zp'], //                              Set top (bottom) margin at row #1
  'set_window':                                          ['wind',                             'wi'], //                              current window is lines #1-#2 cols #3-#4
  'start_bit_image':                                     ['sbim',                             'Zq'], //                              Start printing bit image graphics
  'start_char_set_def':                                  ['scsd',                             'Zr'], //                              Start character set defi‐ nition #1, with #2 charac‐ ters in the set
  'stop_bit_image':                                      ['rbim',                             'Zs'], //                              Stop printing bit image graphics
  'stop_char_set_def':                                   ['rcsd',                             'Zt'], //                              End definition of charac‐ ter set #1
  'subscript_characters':                                ['subcs',                            'Zu'], //                              List of subscriptable characters
  'superscript_characters':                              ['supcs',                            'Zv'], //                              List of superscriptable characters
  'tab':                                                 ['ht',                               'ta'], //                              tab to next 8-space hard‐ ware tab stop
  'these_cause_cr':                                      ['docr',                             'Zw'], //                              Printing any of these characters causes CR
  'to_status_line':                                      ['tsl',                              'ts'], //                              move to status line, col‐ umn #1
  'tone':                                                ['tone',                             'TO'], //                              select touch tone dialing
  'underline_char':                                      ['uc',                               'uc'], //                              underline char and move past it
  'up_half_line':                                        ['hu',                               'hu'], //                              half a line up
  'user0':                                               ['u0',                               'u0'], //                              User string #0
  'user1':                                               ['u1',                               'u1'], //                              User string #1
  'user2':                                               ['u2',                               'u2'], //                              User string #2
  'user3':                                               ['u3',                               'u3'], //                              User string #3
  'user4':                                               ['u4',                               'u4'], //                              User string #4
  'user5':                                               ['u5',                               'u5'], //                              User string #5

  'user6':                                               ['u6',                               'u6'], //                              User string #6
  'user7':                                               ['u7',                               'u7'], //                              User string #7
  'user8':                                               ['u8',                               'u8'], //                              User string #8
  'user9':                                               ['u9',                               'u9'], //                              User string #9
  'wait_tone':                                           ['wait',                             'WA'], //                              wait for dial-tone
  'xoff_character':                                      ['xoffc',                            'XF'], //                              XOFF character
  'xon_character':                                       ['xonc',                             'XN'], //                              XON character
  'zero_motion':                                         ['zerom',                            'Zx'], //                              No motion for subsequent character

  // The following string capabilities are present in the SVr4.0 term structure, but were originally not documented in the man page.


  //         Variable                                      Cap-                                 TCap                                 Description
  //          String                                       name                                 Code
  'alt_scancode_esc':                                      ['scesa',                                'S8'], //                                Alternate escape for scancode emu‐ lation
  'bit_image_carriage_return':                             ['bicr',                                 'Yv'], //                                Move to beginning of same row
  'bit_image_newline':                                     ['binel',                                'Zz'], //                                Move to next row of the bit image
  'bit_image_repeat':                                      ['birep',                                'Xy'], //                                Repeat bit image cell #1 #2 times
  'char_set_names':                                        ['csnm',                                 'Zy'], //                                Produce #1'th item from list of char‐ acter set names
  'code_set_init':                                         ['csin',                                 'ci'], //                                Init sequence for multiple codesets
  'color_names':                                           ['colornm',                              'Yw'], //                                Give name for color #1
  'define_bit_image_region':                               ['defbi',                                'Yx'], //                                Define rectan‐ gualar bit image region
  'device_type':                                           ['devt',                                 'dv'], //                                Indicate lan‐ guage/codeset sup‐ port
  'display_pc_char':                                       ['dispc',                                'S1'], //                                Display PC charac‐ ter #1
  'end_bit_image_region':                                  ['endbi',                                'Yy'], //                                End a bit-image region
  'enter_pc_charset_mode':                                 ['smpch',                                'S2'], //                                Enter PC character display mode
  'enter_scancode_mode':                                   ['smsc',                                 'S4'], //                                Enter PC scancode mode
  'exit_pc_charset_mode':                                  ['rmpch',                                'S3'], //                                Exit PC character display mode
  'exit_scancode_mode':                                    ['rmsc',                                 'S5'], //                                Exit PC scancode mode
  'get_mouse':                                             ['getm',                                 'Gm'], //                                Curses should get button events, parameter #1 not documented.
  'key_mouse':                                             ['kmous',                                'Km'], //                                Mouse event has occurred
  'mouse_info':                                            ['minfo',                                'Mi'], //                                Mouse status information
  'pc_term_options':                                       ['pctrm',                                'S6'], //                                PC terminal options
  'pkey_plab':                                             ['pfxl',                                 'xl'], //                                Program function key #1 to type string #2 and show string #3
  'req_mouse_pos':                                         ['reqmp',                                'RQ'], //                                Request mouse position

  'scancode_escape':                                       ['scesc',                                'S7'], //                                Escape for scan‐ code emulation
  'set0_des_seq':                                          ['s0ds',                                 's0'], //                                Shift to codeset 0 (EUC set 0, ASCII)
  'set1_des_seq':                                          ['s1ds',                                 's1'], //                                Shift to codeset 1
  'set2_des_seq':                                          ['s2ds',                                 's2'], //                                Shift to codeset 2
  'set3_des_seq':                                          ['s3ds',                                 's3'], //                                Shift to codeset 3
  'set_a_background':                                      ['setab',                                'AB'], //                                Set background color to #1, using ANSI escape
  'set_a_foreground':                                      ['setaf',                                'AF'], //                                Set foreground color to #1, using ANSI escape
  'set_color_band':                                        ['setcolor',                             'Yz'], //                                Change to ribbon color #1
  'set_lr_margin':                                         ['smglr',                                'ML'], //                                Set both left and right margins to #1, #2.  (ML is not in BSD term‐ cap).
  'set_page_length':                                       ['slines',                               'YZ'], //                                Set page length to #1 lines
  'set_tb_margin':                                         ['smgtb',                                'MT'], //                                Sets both top and bottom margins to #1, #2

  // The XSI Curses standard added these.  They are some post-4.1 versions of System V curses, e.g., Solaris 2.5 and IRIX 6.x.  The ncurses termcap
  // names for them are invented; according to the XSI Curses standard, they have no termcap names.  If your compiled terminfo entries  use  these,
  // they may not be binary-compatible with System V terminfo entries after SVr4.1; beware!


  //         Variable                                      Cap-                               TCap                                 Description
  //          String                                       name                               Code
  'enter_horizontal_hl_mode':                              ['ehhlm',                              'Xh'], //                               Enter horizontal highlight mode
  'enter_left_hl_mode':                                    ['elhlm',                              'Xl'], //                               Enter left highlight mode
  'enter_low_hl_mode':                                     ['elohlm',                             'Xo'], //                               Enter low highlight mode
  'enter_right_hl_mode':                                   ['erhlm',                              'Xr'], //                               Enter right high‐ light mode
  'enter_top_hl_mode':                                     ['ethlm',                              'Xt'], //                               Enter top highlight mode
  'enter_vertical_hl_mode':                                ['evhlm',                              'Xv'], //                               Enter vertical high‐ light mode
  'set_a_attributes':                                      ['sgr1',                               'sA'], //                               Define second set of video attributes #1-#6
  'set_pglen_inch':                                        ['slength',                            'sL']  //                               YI Set page length to #1 hundredth of an inch
};
